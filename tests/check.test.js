import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "../tools/check/run-check.mjs";
import { buildFixtureSite as buildSite, fixtureNames, sampleSite } from "./fixture-site.js";

const brokenSites = fileURLToPath(new URL("./fixtures/broken-sites", import.meta.url));
const cleanSites = fileURLToPath(new URL("./fixtures/clean-sites", import.meta.url));

const ITEMS = ["content", "accessibility", "console", "privacy", "private-data"];

async function buildFixtureSite(fixturesDir, name) {
  const { siteDir, fixture } = await buildSite(fixturesDir, name);
  return { siteDir, expect: fixture.expect, finding: fixture.finding };
}

test("the sample site passes every item", async () => {
  const items = await runCheck(sampleSite);
  assert.deepEqual(
    items.map((item) => item.id),
    ITEMS,
  );
  for (const item of items) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
});

for (const name of await fixtureNames(brokenSites)) {
  test(`broken site "${name}" is reported under exactly its expected item`, async () => {
    const { siteDir, expect, finding } = await buildFixtureSite(brokenSites, name);
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
      await rm(siteDir, { recursive: true, force: true });
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
    const { siteDir } = await buildFixtureSite(cleanSites, name);
    try {
      for (const item of await runCheck(siteDir)) {
        assert.equal(item.pass, true, `${item.id}: ${item.details}`);
      }
    } finally {
      await rm(siteDir, { recursive: true, force: true });
    }
  });
}

const checkCommand = fileURLToPath(new URL("../tools/check.mjs", import.meta.url));

test("the one command reports in plain language and never fails, even with findings", async () => {
  const { siteDir } = await buildFixtureSite(brokenSites, "no-privacy-page");
  try {
    const run = spawnSync(process.execPath, [checkCommand, siteDir], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /PASS\s+Content file matches the schema/);
    assert.match(run.stdout, /NEEDS ATTENTION\s+Privacy page present/);
    assert.match(run.stdout, /There is no privacy\.html in the site folder/);
    assert.match(run.stdout, /4 of 5 items pass, 1 needs attention\./);
    assert.match(run.stdout, /never stops you from publishing/);
  } finally {
    await rm(siteDir, { recursive: true, force: true });
  }
});

test("the one command checks the repo's own site when given no folder", () => {
  const run = spawnSync(process.execPath, [checkCommand], { encoding: "utf8", cwd: tmpdir() });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /5 of 5 items pass\./);
});

test("the one command explains a wrong folder instead of crashing", () => {
  const run = spawnSync(process.execPath, [checkCommand, join(tmpdir(), "no-such-site-folder")], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /could not find the folder/i);
});
