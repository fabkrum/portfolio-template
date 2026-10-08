import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { briefColours, SIGNATURE_GUIDES, SIGNATURE_MOVES, STYLES, TOKENS } from "../tools/brief/check-brief.mjs";
import { serveBuild } from "../tools/build/serve-build.mjs";
import { findChrome } from "../tools/check/chrome.mjs";
import { runCheck } from "../tools/check/run-check.mjs";
import { lookAtSite } from "../tools/look/look-at-site.mjs";
import { buildFixtureSite, fixtureNames, sampleSite } from "./fixture-site.js";
import { inChrome } from "./in-chrome.js";
import { assertWideLayout } from "./page-layout.js";
import { withRepo } from "./participant-repo.js";
import { lightDarkTokens, loadsFromElsewhere } from "./site-files.js";

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

test("the finder of outside loads catches a Google font and a CDN script", async () => {
  const dir = await mkdtemp(join(tmpdir(), "outside-"));
  try {
    await writeFile(join(dir, "index.html"), '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"><a href="https://github.com/octocat">GitHub</a>');
    await writeFile(join(dir, "styles.css"), "@font-face { src: url(//fonts.gstatic.com/s/inter.woff2); }");
    await writeFile(join(dir, "main.js"), 'import confetti from "https://cdn.example.com/confetti.js";');
    await writeFile(join(dir, "photo.html"), '<img alt="" src="me.jpg" srcset="me.jpg 1x, https://cdn.example.com/me@2x.jpg 2x">');
    // The canonical link and a link preview's image only name an address; the page loads neither.
    await writeFile(join(dir, "head.html"), '<link rel="canonical" href="https://ada-example.github.io/portfolio/"><meta property="og:image" content="https://ada-example.github.io/portfolio/assets/me.webp">');
    assert.equal((await loadsFromElsewhere(dir)).length, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the sample site loads nothing from other servers, before the build and after it", async () => {
  assert.deepEqual(await loadsFromElsewhere(sampleSite), []);
  const site = await serveBuild(sampleSite);
  try {
    assert.deepEqual(await loadsFromElsewhere(site.outDir), []);
  } finally {
    await site.close();
  }
});

test("the site and its tools need no npm: there is no package.json or node_modules", () => {
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
  // The runs are from before node tools/legal.mjs: the placeholder legal page is still there.
  test(`built site "${name}" passes every item of the Check but the legal page`, async () => {
    const { siteDir, remove } = await buildFixtureSite(builtSites, name);
    try {
      for (const item of await runCheck(siteDir)) {
        assert.equal(item.pass, item.id !== "legal", `${item.id}: ${item.details}`);
      }
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
    const site = await serveBuild(siteDir);
    try {
      assert.deepEqual(await loadsFromElsewhere(siteDir), []);
      assert.deepEqual(await loadsFromElsewhere(site.outDir), []);
    } finally {
      await site.close();
      await remove();
    }
  });

  test(`built site "${name}" shows the project cards side by side and its sections apart on a wide screen`, async () => {
    await assertWideLayout(builtSites, name);
  });
}

// The signature menu and the style recipes, next to the Developer skill.
const menu = await read("../.agents/skills/build/signatures.md");
const recipes = await read("../.agents/skills/build/styles.md");
// A Markdown text's "## " parts, by heading.
const partsOf = (markdown) =>
  Object.fromEntries(markdown.split(/^## /m).slice(1).map((part) => [part.split("\n")[0].trim(), part]));
const moves = Object.entries(partsOf(menu)).filter(([heading]) => heading !== "Rules for every move");

// The one move that has no site to copy from: the badges are this workshop's own idea.
const OWN_IDEAS = ["Event badges pop in"];

test("the signature menu names, for every move, an example site and the Modern Web Guidance guide to read first", async () => {
  const indexed = await indexedGuides();
  assert.equal(moves.length, 12, moves.map(([heading]) => heading).join(", "));
  for (const [move, part] of moves) {
    const example = OWN_IDEAS.includes(move) ? "This workshop's own idea, for the event badges\\." : "Like [\\w.-]+\\.\\w+(?:,? (?:and )?[\\w.-]+\\.\\w+)*\\.";
    const guide = part.match(new RegExp(`^${example} Guide: \`(guides\\/[\\w-]+\\/[\\w-]+\\.md)\`$`, "m"))?.[1];
    assert.ok(guide, `${move}: no example and guide line`);
    assert.ok(indexed.includes(guide), `${move}: ${guide} is not in Modern Web Guidance`);
  }
  // The brief checker knows the same moves with the same guides, so a brief can name only these.
  assert.deepEqual(Object.fromEntries(moves.map(([move, part]) => [move, guidePaths(part)[0]])), SIGNATURE_MOVES);
  assert.deepEqual([...SIGNATURE_GUIDES].sort(), Object.values(SIGNATURE_MOVES).sort());
});

test("every move says what happens when the visitor prefers reduced motion", () => {
  for (const [move, part] of moves) assert.match(part, /^- (Reduced motion: .+|Nothing moves, so reduced motion changes nothing\..*)$/m, move);
});

test("the menu's rules: reduced motion means a fade or nothing moves, content is never hidden, text never starts faded", () => {
  const rules = partsOf(menu)["Rules for every move"];
  for (const needed of [/prefers-reduced-motion: reduce/, /becomes a fade, or nothing moves/, /Content is never hidden/, /\*\*No faded text when the page loads\.\*\*/, /keyboard focus/, /exactly one signature move/i]) {
    assert.match(`${menu.split("## Rules")[0]}${rules}`, needed);
  }
});

test("the Designer suggests, per style, moves from the menu, by the menu's own names", async () => {
  const designerStyles = await read("../.agents/skills/design/styles.md");
  const suggested = [...designerStyles.matchAll(/^ {2}- ([^:`]+): `(guides\/[^`]+)`$/gm)];
  assert.ok(suggested.length >= 10, suggested.length);
  const menuParts = partsOf(menu);
  for (const [, name, guide] of suggested) {
    assert.ok(menuParts[name], `"${name}" is not a move on the menu`);
    assert.ok(menuParts[name].includes(`Guide: \`${guide}\``), `${name}: ${guide}`);
  }
});

test("there is a recipe for each of the five styles: type, spacing, shapes, layout, colour, skills, photo, motion and what to avoid", () => {
  const parts = partsOf(recipes);
  for (const style of STYLES) {
    assert.ok(parts[style], style);
    for (const key of ["Type", "Spacing", "Shapes", "Layout", "Colour", "Skills", "Photo", "Motion", "Avoid"]) {
      assert.match(parts[style], new RegExp(`^- \\*\\*${key}\\*\\*: .+`, "m"), `${style}: ${key}`);
    }
  }
});

test("the recipes list the AI look to avoid", () => {
  const look = partsOf(recipes)["The AI look: never by default"];
  assert.ok(look, "no AI look part");
  for (const needed of [/indigo/, /purple/, /Inter/, /centred/, /rounded-lg/, /emoji/, /bento grid/, /cursor/, /pulsing "available" dot/]) assert.match(look, needed);
});

// The legal page is the Developer's too: one command writes it, between looking at the site and the Check.
test("the Developer skill writes the legal page with node tools/legal.mjs after looking and before the Check, translates it, and wants every item to pass", async () => {
  const skill = await read("../.agents/skills/build/SKILL.md");
  const at = (text) => {
    const index = skill.indexOf(text);
    assert.ok(index >= 0, text);
    return index;
  };
  assert.ok(at("node tools/preview.mjs") < at("\nnode tools/legal.mjs\n") && at("\nnode tools/legal.mjs\n") < at("\nnode tools/check.mjs\n"), "look, then the legal page, then the Check");
  for (const needed of [
    "5 of 5 items pass",
    "not legal advice",
    "`legal-notice`, `privacy` and `accessibility`",
    "GDPR article numbers",
    '"Note legali"',
    '"Partita IVA"',
    '"Impressum"',
    "Keep the footer link to `privacy.html`",
    "the legal page: the legal notice with the name and the email address, and the address, the VAT number and the phone number if the content file has them",
    '"The Developer is done. Start a fresh chat and ask for QA:',
  ]) {
    assert.ok(skill.includes(needed), needed);
  }
  assert.doesNotMatch(skill, /Lawyer/);
});

test("the Developer skill builds the style and the one signature move, and takes its fonts from the font folder", async () => {
  const skill = await read("../.agents/skills/build/SKILL.md");
  for (const needed of ["`styles.md`", "`signatures.md`", "node tools/fonts.mjs"]) assert.ok(skill.includes(needed), needed);
  // No download in the room.
  assert.doesNotMatch(skill, /fonts\.google\.com|Download all/);
});

// The Developer's checkpoint is the site the Developer builds from the default brief.
test("the Developer's checkpoint, built from the default brief, is in the Classic style and passes look: no layout mistake, fast, no jumps", async () => {
  await withRepo(async (dir) => {
    const run = spawnSync(process.execPath, [join(dir, "tools", "checkpoint.mjs"), "developer"], { cwd: dir, encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout);
    const page = await inChrome(join(dir, "site"), `document.fonts.ready.then(() => ({
      heading: getComputedStyle(document.querySelector("h1")).fontFamily,
      text: getComputedStyle(document.querySelector("#bio p:not(.headline)")).fontFamily,
      headline: getComputedStyle(document.querySelector(".headline")).fontStyle,
      column: getComputedStyle(document.querySelector("main")).maxWidth,
      cardRadius: getComputedStyle(document.querySelector(".project")).borderRadius,
    }))`);
    assert.match(page.heading, /^"?Newsreader"?,/);
    assert.match(page.text, /^"?Literata"?,/);
    assert.equal(page.headline, "italic");
    assert.equal(page.column, "608px"); // 38rem: one narrow reading column
    assert.equal(page.cardRadius, "0px"); // no cards
    const outDir = await mkdtemp(join(tmpdir(), "look-"));
    try {
      const { layout, performance } = await lookAtSite(join(dir, "site"), outDir, findChrome());
      assert.deepEqual(layout, []);
      assert.ok(performance.lcp > 0 && performance.lcp < 2500, `LCP ${performance.lcp}`);
      assert.ok(performance.cls < 0.1, `CLS ${performance.cls}`);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
