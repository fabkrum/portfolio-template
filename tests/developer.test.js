import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { briefColours, TOKENS } from "../tools/brief/check-brief.mjs";
import { findChrome, launchChrome } from "../tools/check/chrome.mjs";
import { runCheck } from "../tools/check/run-check.mjs";
import { serveSite } from "../tools/check/serve-site.mjs";
import { buildFixtureSite, fixtureNames, sampleSite } from "./fixture-site.js";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const guidanceDir = "../.agents/skills/modern-web-guidance/";

const frontmatter = (skill) => skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";

// Every guide path a text names, like guides/css/css-layout.md.
const guidePaths = (text) => [...text.matchAll(/guides\/[\w-]+\/[\w-]+\.md/g)].map(([path]) => path);
const indexedGuides = async () => guidePaths(await read(`${guidanceDir}index.md`));

test("Modern Web Guidance ships with its Apache-2.0 licence and a notice", async () => {
  assert.match(await read(`${guidanceDir}LICENSE`), /Apache License\s+Version 2\.0/);
  const notice = await read(`${guidanceDir}NOTICE`);
  assert.match(notice, /GoogleChrome\/modern-web-guidance/);
  assert.match(notice, /Apache License,\s+Version 2\.0/);
});

test("Antigravity finds Modern Web Guidance in the workspace skills folder", async () => {
  const meta = frontmatter(await read(`${guidanceDir}SKILL.md`));
  assert.match(meta, /^name: modern-web-guidance$/m);
  assert.match(meta, /^description: .+$/m);
});

test("the index names every guide in the repo, and only those", async () => {
  const guides = await indexedGuides();
  assert.ok(guides.length > 100, `only ${guides.length} guides in the index`);
  const inRepo = (await readdir(new URL(`${guidanceDir}guides`, import.meta.url), { recursive: true }))
    .filter((file) => file.endsWith(".md"))
    .map((file) => `guides/${file.replaceAll("\\", "/")}`);
  assert.deepEqual([...guides].sort(), inRepo.sort());
});

test("Antigravity finds the Developer skill in the workspace skills folder", async () => {
  const meta = frontmatter(await read("../.agents/skills/build/SKILL.md"));
  assert.match(meta, /^name: build$/m);
  assert.match(meta, /^description: .*Developer.*$/m);
});

test("the Developer skill builds from the content file and the brief, guided by Modern Web Guidance", async () => {
  const skill = await read("../.agents/skills/build/SKILL.md");
  for (const needed of ["site/content.json", "design/brief.md", "node tools/check-brief.mjs", "node tools/check.mjs", "light-dark("]) {
    assert.ok(skill.includes(needed), needed);
  }
  // It names the guides to read, and every one of them is in the repo.
  const named = guidePaths(skill);
  assert.ok(named.length > 0, "the skill names no guide");
  const indexed = await indexedGuides();
  assert.deepEqual(named.filter((path) => !indexed.includes(path)), []);
  // Guidance comes before building: the first guide is named before the stylesheet is written.
  assert.ok(skill.indexOf(named[0]) < skill.indexOf("site/assets/styles.css"));
});

// Where the project cards and the sections sit on the page in Chrome at the given window width.
async function pageLayout(siteDir, width) {
  const server = await serveSite(siteDir);
  let chrome;
  try {
    chrome = await launchChrome(findChrome());
    const { cdp } = chrome;
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send("Page.navigate", { url: `${server.origin}/` }, sessionId);
    // main.js fills the page from the content file after load; wait until the cards are there and the fonts are in.
    const expression = `(async () => {
      for (let tries = 0; tries < 100 && !document.querySelector(".project"); tries++) await new Promise((done) => setTimeout(done, 50));
      await document.fonts.ready;
      const box = (element) => {
        const { left, top, bottom } = element.getBoundingClientRect();
        return { id: element.id, left: Math.round(left), top: Math.round(top), bottom: Math.round(bottom) };
      };
      return {
        cards: [...document.querySelectorAll(".project")].map(box),
        sections: [...document.querySelectorAll(".section:not([hidden])")].map(box),
      };
    })()`;
    const { result } = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    return result.value;
  } finally {
    await chrome?.close();
    server.close();
  }
}

// The colour tokens a stylesheet defines with light-dark(), e.g. { accent: { Light: "#1a56db", Dark: "#8fb2ff" } }.
function lightDarkTokens(css) {
  const tokens = {};
  const definition = /--([\w-]+)\s*:\s*light-dark\(\s*(#[0-9a-f]{3,6})\s*,\s*(#[0-9a-f]{3,6})\s*\)/gi;
  for (const [, name, light, dark] of css.matchAll(definition)) {
    tokens[name] = { Light: light.toLowerCase(), Dark: dark.toLowerCase() };
  }
  return tokens;
}

// Every place a site's HTML, CSS or JavaScript would load something from another server.
const LOADS_FROM_ELSEWHERE = [
  /<(?:link|script|img|source|iframe|video|audio)\b[^>]*\b(?:href|src)\s*=\s*["']?(?:https?:)?\/\//i,
  /\bsrcset\s*=\s*["'][^"']*(?:https?:)?\/\//i,
  /url\(\s*["']?(?:https?:)?\/\//i,
  /@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i,
  /\b(?:import|fetch)\s*\(\s*["'`](?:https?:)?\/\//i,
  /\bfrom\s+["'](?:https?:)?\/\//i,
];

async function loadsFromElsewhere(siteDir) {
  const found = [];
  for (const entry of await readdir(siteDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || ![".html", ".css", ".js", ".mjs"].includes(extname(entry.name))) continue;
    const path = join(entry.parentPath, entry.name);
    const text = await readFile(path, "utf8");
    for (const pattern of LOADS_FROM_ELSEWHERE) {
      const match = text.match(pattern);
      if (match) found.push(`${path}: ${match[0]}`);
    }
  }
  return found;
}

test("the finder of outside loads catches a Google font and a CDN script", async () => {
  const dir = await mkdtemp(join(tmpdir(), "outside-"));
  try {
    await writeFile(join(dir, "index.html"), '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"><a href="https://github.com/octocat">GitHub</a>');
    await writeFile(join(dir, "styles.css"), "@font-face { src: url(//fonts.gstatic.com/s/inter.woff2); }");
    await writeFile(join(dir, "main.js"), 'import confetti from "https://cdn.example.com/confetti.js";');
    await writeFile(join(dir, "photo.html"), '<img alt="" src="me.jpg" srcset="me.jpg 1x, https://cdn.example.com/me@2x.jpg 2x">');
    assert.equal((await loadsFromElsewhere(dir)).length, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the sample site loads nothing from other servers", async () => {
  assert.deepEqual(await loadsFromElsewhere(sampleSite), []);
});

test("the site needs no Node and no npm: there is no package.json or node_modules", () => {
  for (const path of ["../package.json", "../node_modules", "../site/package.json", "../site/node_modules"]) {
    assert.equal(existsSync(fileURLToPath(new URL(path, import.meta.url))), false, path);
  }
});

// Sites the Developer skill built in proxy runs. Each folder holds the files
// the run changed in site/, laid over the sample site, and a fixture.json
// naming the brief the run built from.
const builtSites = fileURLToPath(new URL("./fixtures/built-sites", import.meta.url));
const repoFile = (path) => new URL(`../${path}`, import.meta.url);

const builtSiteNames = existsSync(builtSites) ? await fixtureNames(builtSites) : [];

test("there is a site the skill built from the default brief and one from a Stitch brief with a web font", () => {
  const names = builtSiteNames;
  assert.ok(names.includes("default-brief"), names.join(", "));
  assert.ok(names.includes("stitch-web-font"), names.join(", "));
});

for (const name of builtSiteNames) {
  test(`built site "${name}" passes every item of the Check`, async () => {
    const { siteDir, remove } = await buildFixtureSite(builtSites, name);
    try {
      for (const item of await runCheck(siteDir)) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
    } finally {
      await remove();
    }
  });

  test(`built site "${name}" defines the brief's six colours with light-dark()`, async () => {
    const { siteDir, fixture, remove } = await buildFixtureSite(builtSites, name);
    try {
      const brief = briefColours(await readFile(repoFile(fixture.brief), "utf8"));
      const tokens = lightDarkTokens(await readFile(join(siteDir, "assets", "styles.css"), "utf8"));
      for (const token of TOKENS) {
        assert.deepEqual(
          tokens[token],
          { Light: brief.Light[token].toLowerCase(), Dark: brief.Dark[token].toLowerCase() },
          `--${token}`,
        );
      }
    } finally {
      await remove();
    }
  });

  test(`built site "${name}" loads nothing from other servers`, async () => {
    const { siteDir, remove } = await buildFixtureSite(builtSites, name);
    try {
      assert.deepEqual(await loadsFromElsewhere(siteDir), []);
    } finally {
      await remove();
    }
  });

  // Both briefs ask for the project cards side by side in two columns from
  // 40rem, and for 3rem or more between sections; 2rem (32px) is the floor here.
  test(`built site "${name}" shows the project cards side by side and its sections apart on a wide screen`, async () => {
    const { siteDir, remove } = await buildFixtureSite(builtSites, name);
    try {
      const { cards, sections } = await pageLayout(siteDir, 1280);
      const [first, second] = cards;
      assert.ok(first && second, "fewer than two project cards on the page");
      assert.equal(second.top, first.top, `cards at ${JSON.stringify(cards)}`);
      assert.ok(second.left > first.left, `cards at ${JSON.stringify(cards)}`);
      assert.equal(sections.length, 4, JSON.stringify(sections));
      for (const [above, below] of sections.slice(1).map((section, index) => [sections[index], section])) {
        assert.ok(below.top - above.bottom >= 32, `${below.top - above.bottom}px between #${above.id} and #${below.id}`);
      }
    } finally {
      await remove();
    }
  });
}
