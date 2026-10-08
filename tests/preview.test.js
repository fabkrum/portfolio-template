import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withRepo } from "./participant-repo.js";

// Starts node tools/preview.mjs in a participant's repo, the way they start
// it, and waits until it prints its address. said() is everything it printed
// so far; stop() ends it, as Ctrl+C does.
async function startPreview(dir) {
  const child = spawn(process.execPath, [join("tools", "preview.mjs")], { cwd: dir });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => (output += chunk));
  const address = await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`The preview printed no address:\n${output}`)), 15_000);
    child.stdout.on("data", () => {
      const match = output.match(/running at (http:\/\/localhost:\d+)/);
      if (match) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`The preview stopped (${code}):\n${output}`));
    });
  });
  const stop = () =>
    new Promise((done) => {
      if (child.exitCode !== null) return done();
      child.once("exit", done);
      child.kill();
    });
  return { address, said: () => output, stop };
}

const open = async (url) => {
  const response = await fetch(url);
  return { status: response.status, html: await response.text() };
};

// Runs use(preview, dir) on a fresh participant's repo with the preview running.
async function withPreview(use) {
  await withRepo(async (dir) => {
    const preview = await startPreview(dir);
    try {
      await use(preview, dir);
    } finally {
      await preview.stop();
    }
  });
}

test("the preview builds the site into _site/ and serves the finished page, with its own address in it", async () => {
  await withPreview(async ({ address, said }, dir) => {
    const { status, html } = await open(`${address}/`);
    assert.match(said(), /Open that address in Chrome\. After a change, reload the page/);
    assert.equal(status, 200);
    assert.match(html, /<h1>Ada Example<\/h1>/);
    assert.match(html, /<title>Ada Example · Portfolio<\/title>/);
    assert.ok(html.includes(`<link rel="canonical" href="${address}/">`));
    assert.match((await open(`${address}/robots.txt`)).html, new RegExp(`Sitemap: ${address}/sitemap\\.xml`));
    assert.ok(existsSync(join(dir, "_site", "index.html")));
  });
});

test("after a change in site/, a reload shows it: the preview builds the site again first", async () => {
  await withPreview(async ({ address }, dir) => {
    assert.match((await open(`${address}/`)).html, /<h1>Ada Example<\/h1>/);
    const path = join(dir, "site", "content.json");
    await writeFile(path, (await readFile(path, "utf8")).replace('"name": "Ada Example"', '"name": "Ada Lovelace Example"'));
    assert.match((await open(`${address}/`)).html, /<h1>Ada Lovelace Example<\/h1>/);
    assert.match((await open(`${address}/privacy.html`)).html, /Legal notice &amp; privacy/);
  });
});

test("while the site cannot be built, the page and the preview's window say why; once it is fixed, the site is back", async () => {
  await withPreview(async ({ address, said }, dir) => {
    const path = join(dir, "site", "content.json");
    const content = await readFile(path, "utf8");
    await writeFile(path, '{ "name": "Ada Example", ');
    const broken = await open(`${address}/`);
    assert.equal(broken.status, 500);
    assert.match(broken.html, /<h1>Your site could not be built<\/h1>/);
    assert.match(broken.html, /content\.json is not valid JSON/);
    assert.match(said(), /Your site could not be built: content\.json is not valid JSON/);
    await writeFile(path, content);
    const fixed = await open(`${address}/`);
    assert.equal(fixed.status, 200);
    assert.match(fixed.html, /<h1>Ada Example<\/h1>/);
    assert.match(said(), /Your site builds again\./);
  });
});
