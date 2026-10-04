// Look at your site. Run it from your repo folder:
//
//   node tools/look.mjs
//
// It opens every page of your site in your own Chrome, at phone and at wide
// width, in light and in dark mode, and saves a screenshot of each into the
// folder qa/. It also measures how fast the home page shows up on a phone
// with a slow connection, and whether it jumps while it loads. It only
// reports: it never stops you from publishing.
// Add a folder name to look at another site folder, and a second one to save
// the screenshots elsewhere: node tools/look.mjs my-site my-screenshots
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome } from "./check/chrome.mjs";
import { GOOD, lookAtSite } from "./look/look-at-site.mjs";

const ATTENTION = "NEEDS ATTENTION";
const PASS = "PASS".padEnd(ATTENTION.length);

const siteDir = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL("../site", import.meta.url));
const outDir = process.argv[3] ? resolve(process.argv[3]) : fileURLToPath(new URL("../qa", import.meta.url));

const status = (good) => (good ? PASS : ATTENTION);
const shown = (path) => {
  const fromHere = relative(process.cwd(), path);
  return fromHere.startsWith("..") ? path : fromHere;
};

function report({ screenshots, performance, layout }) {
  console.log(`Looking at your portfolio site in ${siteDir}\n`);
  console.log("Screenshots. Open each one and look at it: does it match the design brief?");
  for (const file of screenshots) console.log(`  ${shown(file)}`);

  console.log("\nThe home page on a mid-range phone with a slow 4G connection:");
  const good = `(good: ${GOOD.lcp / 1000} s or less)`;
  console.log(
    performance.lcp === null
      ? `  ${ATTENTION}  Largest Contentful Paint: could not be measured; the page may show nothing ${good}`
      : `  ${status(performance.lcp <= GOOD.lcp)}  Largest Contentful Paint: ${(performance.lcp / 1000).toFixed(1)} s until the biggest text or image shows ${good}`,
  );
  console.log(
    `  ${status(performance.cls <= GOOD.cls)}  Cumulative Layout Shift: ${performance.cls} (good: ${GOOD.cls} or less; above that, the page jumps while it loads)`,
  );

  console.log("\nLayout:");
  if (layout.length === 0) {
    console.log(`  ${PASS}  No page wider than the screen, every heading above its content, no section half empty, space between all sections`);
  }
  for (const problem of layout) console.log(`  ${ATTENTION}  ${problem}`);
}

const nodeMajor = Number(process.versions.node.split(".")[0]);

try {
  const chromePath = findChrome();
  if (nodeMajor < 22) {
    console.log(`This needs Node 22 or newer; this is Node ${process.versions.node}.`);
    console.log("Run the install script again, or install the current Node LTS from nodejs.org.");
  } else if (!existsSync(siteDir)) {
    console.log(`Could not find the folder ${siteDir}.`);
    console.log("Run this from your repo folder, or give it the path to your site folder.");
  } else if (!chromePath) {
    console.log("Google Chrome was not found. Install Chrome and run this again.");
  } else {
    report(await lookAtSite(siteDir, outDir, chromePath));
  }
} catch (error) {
  console.log(`Looking at the site ran into a problem: ${error.message}`);
}
console.log("\nThis only reports. It never stops you from publishing.");
process.exitCode = 0;
