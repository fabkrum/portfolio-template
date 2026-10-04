import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome } from "../tools/check/chrome.mjs";
import { lookAtSite } from "../tools/look/look-at-site.mjs";
import { buildFixtureSite } from "./fixture-site.js";

const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const lookCommand = fileURLToPath(new URL("../tools/look.mjs", import.meta.url));

// A fixture site and an empty folder for the screenshots, removed afterwards.
async function withSite(name, run) {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, name);
  const outDir = await mkdtemp(join(tmpdir(), "look-"));
  try {
    return await run(siteDir, outDir);
  } finally {
    await remove();
    await rm(outDir, { recursive: true, force: true });
  }
}

// The width and height a PNG file declares in its header.
async function pngSize(path) {
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(1, 4).toString(), "PNG", `${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("look saves every page at phone and wide width, in light and dark mode", async () => {
  await withSite("built-sites/default-brief", async (siteDir, outDir) => {
    const { screenshots } = await lookAtSite(siteDir, outDir, findChrome());
    assert.deepEqual((await readdir(outDir)).sort(), [
      "index-phone-dark.png", "index-phone-light.png", "index-wide-dark.png", "index-wide-light.png",
      "privacy-phone-dark.png", "privacy-phone-light.png", "privacy-wide-dark.png", "privacy-wide-light.png",
    ]);
    assert.equal(screenshots.length, 8);
    for (const file of await readdir(outDir)) {
      const { width, height } = await pngSize(join(outDir, file));
      assert.equal(width, file.includes("phone") ? 390 : 1280, file);
      // The whole page, not only the first screen: the sample page is taller than a phone screen.
      if (file === "index-phone-light.png") assert.ok(height > 900, `${file} is only ${height}px tall`);
    }
    const light = await readFile(join(outDir, "index-wide-light.png"));
    const dark = await readFile(join(outDir, "index-wide-dark.png"));
    assert.notDeepEqual(light, dark);
  });
});

test("look measures LCP and CLS of the home page, and a well-built page does well", async () => {
  await withSite("built-sites/default-brief", async (siteDir, outDir) => {
    const { performance, layout } = await lookAtSite(siteDir, outDir, findChrome());
    assert.ok(performance.lcp > 0, `LCP ${performance.lcp}`);
    assert.ok(performance.lcp < 2500, `LCP ${performance.lcp}`);
    assert.ok(performance.cls < 0.1, `CLS ${performance.cls}`);
    assert.deepEqual(layout, []);
  });
});

test("look catches a page that jumps while it loads", async () => {
  await withSite("look-sites/layout-shift", async (siteDir, outDir) => {
    const { performance } = await lookAtSite(siteDir, outDir, findChrome());
    assert.ok(performance.cls > 0.1, `CLS ${performance.cls}`);
  });
});

test("look catches a page wider than a phone screen", async () => {
  await withSite("look-sites/too-wide", async (siteDir, outDir) => {
    const { layout } = await lookAtSite(siteDir, outDir, findChrome());
    assert.equal(layout.length, 1, JSON.stringify(layout));
    assert.match(layout[0], /index\.html.*phone.*wider than the screen/);
  });
});

test("the one command reports in plain language, saves the screenshots and never fails", async () => {
  await withSite("look-sites/layout-shift", async (siteDir, outDir) => {
    const run = spawnSync(process.execPath, [lookCommand, siteDir, outDir], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /index-phone-light\.png/);
    assert.match(run.stdout, /Largest Contentful Paint.*\d+(\.\d+)? s/);
    assert.match(run.stdout, /NEEDS ATTENTION\s+Cumulative Layout Shift/);
    assert.match(run.stdout, /never stops you from publishing/);
    assert.equal((await readdir(outDir)).length, 8);
  });
});
