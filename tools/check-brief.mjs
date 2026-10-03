// Checks the design brief. The Designer role runs it after writing the brief:
//
//   node tools/check-brief.mjs
//
// It says whether design/brief.md has every section the Developer needs and
// whether its colours are readable on each other. Like the Check, it only
// reports. Add a path to check another file: node tools/check-brief.mjs my-brief.md
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { checkBrief } from "./brief/check-brief.mjs";

const shownPath = process.argv[2] ?? "design/brief.md";
const path = process.argv[2] ? resolve(process.argv[2]) : new URL("../design/brief.md", import.meta.url);

try {
  const problems = checkBrief(await readFile(path, "utf8"));
  if (problems.length === 0) {
    console.log(`${shownPath} is ready for the Developer: every section is there and every colour pair is readable.`);
  } else {
    console.log(`${shownPath} has ${problems.length} thing${problems.length === 1 ? "" : "s"} to fix:\n`);
    for (const problem of problems) console.log(`  - ${problem}`);
  }
} catch (error) {
  console.log(
    error.code === "ENOENT"
      ? `There is no design brief at ${shownPath}. The Designer role writes it.`
      : `The brief could not be read: ${error.message}`,
  );
}
// Always 0: this reports, it never gates.
process.exitCode = 0;
