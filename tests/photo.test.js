import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HIDDEN, holdsPosition, inBlankChrome, jpegFromChrome, webpChunks, webpSize, withHiddenData } from "./photos.js";
import { withRepo } from "./participant-repo.js";

// The command, run the way the Analyst runs it: from the repo folder.
const photoTool = (dir, ...args) => spawnSync(process.execPath, [join(dir, "tools", "photo.mjs"), ...args], { cwd: dir, encoding: "utf8" });

// A photo as a phone takes it: 4000 × 3000 pixels, with where and when it was taken.
const phonePhoto = withHiddenData(await jpegFromChrome({ width: 4000, height: 3000 }));

test("node tools/photo.mjs turns a large JPEG into a small square WebP without its hidden data", async () => {
  assert.ok(holdsPosition(phonePhoto), "the planted photo holds a position");
  await withRepo(async (dir) => {
    await writeFile(join(dir, "My Photo.jpg"), phonePhoto);
    const { status, stdout } = photoTool(dir, "My Photo.jpg");
    assert.equal(status, 0, stdout);
    const webp = await readFile(join(dir, "site", "assets", "photo.webp"));
    assert.deepEqual(webpSize(webp), { width: 480, height: 480 });
    // Pixels and Chrome's sRGB colour profile, the same in every copy: no EXIF and no XMP chunk.
    assert.ok(webpChunks(webp).every((chunk) => ["VP8 ", "VP8L", "VP8X", "ALPH", "ICCP"].includes(chunk)), webpChunks(webp).join());
    for (const hidden of HIDDEN) assert.ok(!webp.includes(hidden), hidden);
    assert.equal(holdsPosition(webp), false);
    assert.ok(webp.length < 60 * 1024 && webp.length * 20 < phonePhoto.length, `${webp.length} bytes from ${phonePhoto.length}`);
    // What it says: where the photo is, what goes into the content file, and to delete the original.
    for (const said of ["site/assets/photo.webp", "480 × 480", "where and when it was taken", '"src": "assets/photo.webp"', '"alt"', "Delete My Photo.jpg from your repo folder"]) {
      assert.ok(stdout.includes(said), said);
    }
  });
});

test("a photo turned on its side by the phone comes out upright", async () => {
  // Saved as 600 × 400, red on the left and blue on the right; the phone
  // says to turn it a quarter clockwise, so upright it is red above blue.
  const sideways = withHiddenData(await jpegFromChrome({ width: 600, height: 400, halves: true }), { orientation: 6 });
  await withRepo(async (dir) => {
    await writeFile(join(dir, "sideways.jpg"), sideways);
    const { status, stdout } = photoTool(dir, "sideways.jpg");
    assert.equal(status, 0, stdout);
    const webp = await readFile(join(dir, "site", "assets", "photo.webp"));
    assert.deepEqual(webpSize(webp), { width: 400, height: 400 });
    assert.match(stdout, /only 400 pixels/);
    const [top, bottom] = await inBlankChrome(`(async () => {
      const image = new Image();
      image.src = "data:image/webp;base64,${webp.toString("base64")}";
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 400;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return [[300, 40], [100, 360]].map(([x, y]) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)]);
    })()`);
    assert.ok(top[0] > 200 && top[2] < 60, `top ${top}`);
    assert.ok(bottom[2] > 200 && bottom[0] < 60, `bottom ${bottom}`);
  });
});

test("a HEIC photo from an iPhone gets plain words: save it as JPEG or PNG first, and nothing is written", async () => {
  await withRepo(async (dir) => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1"), Buffer.alloc(64)]);
    await writeFile(join(dir, "IMG_0001.HEIC"), heic);
    const { status, stdout } = photoTool(dir, "IMG_0001.HEIC");
    assert.equal(status, 1, stdout);
    assert.match(stdout, /IMG_0001\.HEIC is a HEIC photo/);
    assert.match(stdout, /Save it as JPEG or PNG first/);
    assert.ok(!existsSync(join(dir, "site", "assets", "photo.webp")));
  });
});

test("a file that is not a picture is named, and nothing is written", async () => {
  await withRepo(async (dir) => {
    await writeFile(join(dir, "notes.txt"), "Not a photo.");
    const { status, stdout } = photoTool(dir, "notes.txt");
    assert.equal(status, 1, stdout);
    assert.match(stdout, /Chrome could not read notes\.txt as a picture/);
    assert.ok(!existsSync(join(dir, "site", "assets", "photo.webp")));
  });
});

test("without a file name, or with one that is not there, the command says how to use it", async () => {
  await withRepo(async (dir) => {
    const none = photoTool(dir);
    assert.equal(none.status, 0, none.stdout);
    assert.match(none.stdout, /Copy your photo into your repo folder/);
    assert.match(none.stdout, /node tools\/photo\.mjs my-photo\.jpg/);
    const missing = photoTool(dir, "me.jpg");
    assert.equal(missing.status, 1, missing.stdout);
    assert.match(missing.stdout, /There is no file called me\.jpg/);
  });
});
