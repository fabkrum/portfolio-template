import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../tools/build/build-site.mjs";
import { agentViewProblems } from "../tools/check/agent-view.mjs";
import { runCheck } from "../tools/check/run-check.mjs";
import { buildFixtureSite, fixtureNames, sampleSite } from "./fixture-site.js";
import { inChrome } from "./in-chrome.js";

const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const brokenSites = fileURLToPath(new URL("./fixtures/broken-sites", import.meta.url));
const cleanSites = fileURLToPath(new URL("./fixtures/clean-sites", import.meta.url));

const ITEMS = ["content", "accessibility", "console", "agent", "legal"];

// The template ships a placeholder legal page; the Lawyer role replaces it.
test("the sample site passes every item but the legal page, which waits for the Lawyer", async () => {
  const items = await runCheck(sampleSite);
  assert.deepEqual(
    items.map((item) => item.id),
    ITEMS,
  );
  assert.equal(items.find((item) => item.id === "legal").title, "Legal page written");
  for (const item of items.filter((item) => item.id !== "legal")) {
    assert.equal(item.pass, true, `${item.id}: ${item.details}`);
  }
  const legal = items.find((item) => item.id === "legal");
  assert.equal(legal.pass, false);
  assert.match(legal.details.join("\n"), /placeholder.*Lawyer/);
});

test("the sample site with a finished legal page passes every item", async () => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "finished-privacy");
  try {
    for (const item of await runCheck(siteDir)) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
  } finally {
    await remove();
  }
});

for (const name of await fixtureNames(brokenSites)) {
  test(`broken site "${name}" is reported under exactly its expected item`, async () => {
    const { siteDir, fixture: { expect, finding }, remove } = await buildFixtureSite(brokenSites, name);
    try {
      const items = await runCheck(siteDir);
      const flagged = items.filter((item) => !item.pass);
      assert.deepEqual(
        flagged.map((item) => item.id),
        [expect],
        JSON.stringify(flagged, null, 2),
      );
      assert.match(flagged[0].details.join("\n"), new RegExp(finding, "i"));
    } finally {
      await remove();
    }
  });
}

// The content files #2 proved check-jsonschema rejects must be rejected here too.
const invalidContent = fileURLToPath(new URL("./fixtures/invalid-content", import.meta.url));
for (const file of await readdir(invalidContent)) {
  test(`invalid content file "${file}" is reported under the content item`, async () => {
    const siteDir = await mkdtemp(join(tmpdir(), "invalid-content-"));
    try {
      await cp(sampleSite, siteDir, { recursive: true });
      await cp(join(invalidContent, file), join(siteDir, "content.json"));
      const content = (await runCheck(siteDir)).find((item) => item.id === "content");
      assert.equal(content.pass, false);
      assert.ok(content.details.length > 0);
    } finally {
      await rm(siteDir, { recursive: true, force: true });
    }
  });
}

for (const name of await fixtureNames(cleanSites)) {
  test(`clean site "${name}" passes every item`, async () => {
    const { siteDir, remove } = await buildFixtureSite(cleanSites, name);
    try {
      for (const item of await runCheck(siteDir)) {
        assert.equal(item.pass, true, `${item.id}: ${item.details}`);
      }
    } finally {
      await remove();
    }
  });
}

// The broken site's content is there for a visitor, once JavaScript has run;
// only a reader that runs none misses it.
test('broken site "content-only-in-javascript" shows its content in Chrome, after JavaScript', async () => {
  const { siteDir, remove } = await buildFixtureSite(brokenSites, "content-only-in-javascript");
  try {
    const shown = await inChrome(siteDir, `[...document.querySelectorAll("h1, h3")].map((heading) => heading.textContent)`);
    assert.deepEqual(shown, ["Ada Example", "Tide Tables", "Reading Log"]);
  } finally {
    await remove();
  }
});

const sample = JSON.parse(await readFile(join(sampleSite, "content.json"), "utf8"));

// What an agent misses in the sample site, built, once change(builtDir) has
// changed the built files.
async function agentMisses(change) {
  const dir = await mkdtemp(join(tmpdir(), "agent-view-"));
  try {
    await buildSite(sampleSite, dir, { address: "https://ada-example.github.io/portfolio/" });
    await change(dir);
    return await agentViewProblems(dir, sample);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const changePage = (edit) => async (dir) => writeFile(join(dir, "index.html"), edit(await readFile(join(dir, "index.html"), "utf8")));

test("what an agent sees: in the built sample site, everything", async () => {
  assert.deepEqual(await agentMisses(async () => {}), []);
});

test("what an agent sees: a project title only in a script, a template or a comment does not count", async () => {
  const hidden = changePage((page) =>
    page
      .replace("<h3>Tide Tables</h3>", "<h3><template>Tide Tables</template></h3>")
      .replace("<h3>Reading Log</h3>", '<h3><script>document.write("Reading Log")</script><!-- Reading Log --></h3>'),
  );
  const found = await agentMisses(hidden);
  assert.deepEqual(found.slice(0, 2), ['Without JavaScript, index.html does not show the project "Tide Tables".', 'Without JavaScript, index.html does not show the project "Reading Log".']);
  assert.match(found[2], /keep JavaScript for extras/);
  assert.equal(found.length, 3);
});

test("what an agent sees: structured data that is missing, broken or about someone else is named", async () => {
  const jsonLd = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
  assert.deepEqual(await agentMisses(changePage((page) => page.replace(jsonLd, ""))), [
    "index.html has no structured data (JSON-LD) that says who you are. The build adds it into the page's <head>, so index.html needs one.",
  ]);
  const [broken] = await agentMisses(changePage((page) => page.replace(jsonLd, '<script type="application/ld+json">{ "@type": </script>')));
  assert.match(broken, /^The structured data \(JSON-LD\) in index\.html is not valid JSON: /);
  assert.deepEqual(await agentMisses(changePage((page) => page.replace(jsonLd, '<script type="application/ld+json">{ "@type": "Person", "name": "Someone Else" }</script>'))), [
    'The structured data (JSON-LD) in index.html does not name you, "Ada Example", as a Person.',
  ]);
});

test("what an agent sees: a missing robots.txt or sitemap.xml is named", async () => {
  const found = await agentMisses(async (dir) => {
    await rm(join(dir, "robots.txt"));
    await rm(join(dir, "sitemap.xml"));
  });
  assert.deepEqual(found, ["There is no robots.txt next to the pages.", "There is no sitemap.xml next to the pages."]);
});

test("what an agent sees: without a name in the content file, no structured data is missed; the content item names the name", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-view-"));
  const siteDir = join(dir, "site");
  try {
    await cp(sampleSite, siteDir, { recursive: true });
    const { name, ...nameless } = sample;
    await writeFile(join(siteDir, "content.json"), JSON.stringify(nameless));
    await buildSite(siteDir, join(dir, "built"), { address: "https://ada-example.github.io/portfolio/" });
    assert.deepEqual(await agentViewProblems(join(dir, "built"), nameless), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a content file that starts with a byte order mark is read like any other: every item is reported", async () => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "finished-privacy");
  try {
    await writeFile(join(siteDir, "content.json"), `\uFEFF${await readFile(join(siteDir, "content.json"), "utf8")}`);
    const items = await runCheck(siteDir);
    assert.deepEqual(items.map((item) => item.id), ITEMS);
    for (const item of items) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
  } finally {
    await remove();
  }
});

// A file the build cannot read: the Check reports every item all the same.
// Not on Windows, and not as root: there, a file stays readable.
const unreadableFiles = process.platform === "win32" || process.getuid?.() === 0;

test("when the Check cannot build the site for another reason, the items that look at the built site say so and the others still report", { skip: unreadableFiles && "a file stays readable here" }, async () => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "finished-privacy");
  try {
    await chmod(join(siteDir, "assets", "favicon.svg"), 0o000);
    const items = await runCheck(siteDir);
    assert.deepEqual(items.map((item) => item.id), ITEMS);
    assert.deepEqual(items.filter((item) => !item.pass).map((item) => item.id), ["accessibility", "console", "agent"]);
    for (const item of items.filter((item) => !item.pass)) {
      assert.match(item.details.join("\n"), /^The Check could not build and open the site, so this could not be checked: /);
    }
  } finally {
    await chmod(join(siteDir, "assets", "favicon.svg"), 0o644);
    await remove();
  }
});

test("a site that cannot be built is named under every item that looks at the built site", async () => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "finished-privacy");
  try {
    await writeFile(join(siteDir, "assets", "render.js"), "export function renderSections( {");
    const items = await runCheck(siteDir);
    assert.deepEqual(items.filter((item) => !item.pass).map((item) => item.id), ["accessibility", "console", "agent"]);
    for (const item of items.filter((item) => !item.pass)) {
      assert.match(item.details.join("\n"), /^The site could not be built, so this could not be checked: assets\/render\.js has a mistake/);
    }
  } finally {
    await remove();
  }
});

const checkCommand = fileURLToPath(new URL("../tools/check.mjs", import.meta.url));

test("the one command reports in plain language and never fails, even with findings", async () => {
  const { siteDir, remove } = await buildFixtureSite(brokenSites, "no-privacy-page");
  try {
    const run = spawnSync(process.execPath, [checkCommand, siteDir], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /PASS\s+Content file matches the schema/);
    assert.match(run.stdout, /NEEDS ATTENTION\s+Legal page written/);
    assert.match(run.stdout, /There is no privacy\.html in the site folder/);
    assert.match(run.stdout, /4 of 5 items pass, 1 needs attention\./);
    assert.match(run.stdout, /never stops you from publishing/);
  } finally {
    await remove();
  }
});

test("the one command checks the repo's own site when given no folder", () => {
  const run = spawnSync(process.execPath, [checkCommand], { encoding: "utf8", cwd: tmpdir() });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /4 of 5 items pass, 1 needs attention\./);
  assert.match(run.stdout, /NEEDS ATTENTION\s+Legal page written/);
});

test("the one command explains a wrong folder instead of crashing", () => {
  const run = spawnSync(process.execPath, [checkCommand, join(tmpdir(), "no-such-site-folder")], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /could not find the folder/i);
});
