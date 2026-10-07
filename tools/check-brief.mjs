// Checks the design brief. The Designer role runs it after writing the brief:
//
//   node tools/check-brief.mjs
//
// It says whether design/brief.md has every section the Developer needs and
// whether its colours are readable on each other, then what is good to know:
// a web font the site cannot load in the workshop, or a style section left
// out. Like the Check, it only reports. Add a path to check another file:
// node tools/check-brief.mjs my-brief.md
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { briefNotes, checkBrief } from "./brief/check-brief.mjs";
import { bundledFonts } from "./fonts/bundled-fonts.mjs";

const repoDir = fileURLToPath(new URL("..", import.meta.url));
const shownPath = process.argv[2] ?? "design/brief.md";
const path = process.argv[2] ? resolve(process.argv[2]) : new URL("../design/brief.md", import.meta.url);

try {
  const brief = await readFile(path, "utf8");
  const problems = checkBrief(brief);
  if (problems.length === 0) {
    console.log(`${shownPath} is ready for the Developer: every section is there and every colour pair is readable.`);
  } else {
    console.log(`${shownPath} has ${problems.length} thing${problems.length === 1 ? "" : "s"} to fix:\n`);
    for (const problem of problems) console.log(`  - ${problem}`);
  }
  const notes = briefNotes(brief, { bundled: (await bundledFonts(repoDir)).map(({ name }) => name) });
  if (notes.length > 0) {
    console.log("\nGood to know:\n");
    for (const note of notes) console.log(`  - ${note}`);
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
