// The Check. Run it from your repo folder:
//
//   node tools/check.mjs
//
// It builds your site, looks at it and tells you, item by item, what passes
// and what needs attention. It only reports: it never stops you from
// publishing.
// Add a folder name to check another site folder: node tools/check.mjs my-site
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "./check/run-check.mjs";

const ATTENTION = "NEEDS ATTENTION";
const PASS = "PASS".padEnd(ATTENTION.length);
const INDENT = " ".repeat(PASS.length + 4);

const siteDir = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../site", import.meta.url));

function report(items) {
  console.log(`Checking your portfolio site in ${siteDir}\n`);
  for (const item of items) {
    console.log(`  ${item.pass ? PASS : ATTENTION}  ${item.title}`);
    for (const detail of item.details) console.log(`${INDENT}- ${detail}`);
  }
  const passed = items.filter((item) => item.pass).length;
  const open = items.length - passed;
  console.log(
    open === 0
      ? `\n${passed} of ${items.length} items pass.`
      : `\n${passed} of ${items.length} items pass, ${open} need${open === 1 ? "s" : ""} attention.`,
  );
}

const nodeMajor = Number(process.versions.node.split(".")[0]);

try {
  if (nodeMajor < 22) {
    console.log(`The Check needs Node 22 or newer; this is Node ${process.versions.node}.`);
    console.log("Run the install script again, or install the current Node LTS from nodejs.org.");
  } else if (!existsSync(siteDir)) {
    console.log(`The Check could not find the folder ${siteDir}.`);
    console.log("Run it from your repo folder, or give it the path to your site folder.");
  } else {
    report(await runCheck(siteDir));
  }
} catch (error) {
  console.log(`The Check itself ran into a problem: ${error.message}`);
}
console.log("This Check only reports. It never stops you from publishing.");
// Always 0: the Check reports, it never gates.
process.exitCode = 0;
