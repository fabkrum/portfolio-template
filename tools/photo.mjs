// A photo of you for your site. Copy the photo into your repo folder, then
// run this from your repo folder with its file name:
//
//   node tools/photo.mjs my-photo.jpg
//
// It cuts a square from the middle of the photo, makes it at most 480 × 480
// pixels and saves it as site/assets/photo.webp: small, so it loads fast, and
// without the hidden data a phone or camera saves in a photo, such as where
// and when it was taken. It uses your own Chrome, like the Check, and it is
// the same command on every system.
import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome } from "./check/chrome.mjs";
import { SIZE, squarePhoto } from "./photo/square-photo.mjs";

const repoDir = fileURLToPath(new URL("..", import.meta.url));
const outPath = fileURLToPath(new URL("../site/assets/photo.webp", import.meta.url));
const OUT = "site/assets/photo.webp";

const USAGE = [
  "Copy your photo into your repo folder, then run this with its file name:",
  "",
  "  node tools/photo.mjs my-photo.jpg",
  "",
  'If the name has a space, put it in quotes: node tools/photo.mjs "my photo.jpg"',
];

// iPhones save photos as HEIC unless told otherwise, and Chrome cannot read it.
const isHeic = (path) => /^\.hei[cf]$/i.test(extname(path));

const inRepo = (path) => {
  const fromRepo = relative(repoDir, path);
  return fromRepo !== "" && !fromRepo.startsWith("..") && !isAbsolute(fromRepo);
};

const size = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function cannotRead(name, path) {
  if (isHeic(path)) {
    return [
      `${name} is a HEIC photo, the format iPhones save by default, and Chrome cannot read it. Save it as JPEG or PNG first:`,
      "  - on a Mac, open it in Preview, choose File, then Export, and pick JPEG as the format;",
      "  - on Windows, open it in Photos, choose Save as, and pick JPEG.",
      "Then run this again with the new file's name.",
    ];
  }
  return [`Chrome could not read ${name} as a picture. Save it as JPEG or PNG first, then run this again with the new file's name.`];
}

function report(name, path, original, { width, height, size: side, webp }) {
  console.log(`Your photo is ready: ${OUT}`);
  console.log(`  A square from the middle of your photo, ${side} × ${side} pixels, ${size(webp.length)} (the photo was ${size(original)}).`);
  console.log("  It holds none of the hidden data your phone or camera saved in the photo, such as where and when it was taken.");
  if (side < SIZE) {
    console.log(`  Your photo is only ${Math.min(width, height)} pixels on its short side, so it may look blurry on sharp screens. A bigger photo looks better.`);
  }
  console.log("\nNext:");
  console.log(`  - Open ${OUT} and look at it. If the square cuts off your face, crop the photo first, then run this again.`);
  console.log("  - Put it into site/content.json with its alt text: a few words about what it shows, for people who cannot see it.");
  console.log('      "photo": { "src": "assets/photo.webp", "alt": "Smiling in front of a bookshelf" }');
  if (inRepo(path) && path !== outPath) {
    console.log(`  - Delete ${name} from your repo folder: it still holds the hidden data, and everything in your repo folder can end up public.`);
  }
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
const given = process.argv[2];

try {
  if (nodeMajor < 22) {
    console.log(`This needs Node 22 or newer; this is Node ${process.versions.node}.`);
    console.log("Run the install script again, or install the current Node LTS from nodejs.org.");
    process.exitCode = 1;
  } else if (!given) {
    console.log(["Which photo?", ...USAGE].join("\n"));
  } else {
    const path = resolve(given);
    const name = basename(path);
    if (!existsSync(path) || !statSync(path).isFile()) {
      console.log([`There is no file called ${name} in ${dirname(path)}.`, ...USAGE].join("\n"));
      process.exitCode = 1;
    } else {
      const chromePath = findChrome();
      if (!chromePath) {
        console.log("Google Chrome was not found. Install Chrome and run this again.");
        process.exitCode = 1;
      } else {
        const original = statSync(path).size;
        const photo = await squarePhoto(path, chromePath);
        if (photo.unreadable) {
          console.log(cannotRead(name, path).join("\n"));
          process.exitCode = 1;
        } else {
          await mkdir(dirname(outPath), { recursive: true });
          await writeFile(outPath, photo.webp);
          report(name, path, original, photo);
        }
      }
    }
  }
} catch (error) {
  console.log(`Your photo could not be made: ${error.message}.`);
  console.log("Nothing was changed. Ask the instructor for help.");
  process.exitCode = 1;
}
