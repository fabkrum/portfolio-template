// Checks the content file. The Analyst role runs it after writing the file:
//
//   node tools/check-content.mjs
//
// It says whether site/content.json matches site/content.schema.json and
// whether anything in it looks like a phone number or a postal address. It
// needs no Chrome, so it is quick. Like the Check, it only reports. Add a path
// to check another file: node tools/check-content.mjs my-content.json
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findPrivateDataInContent } from "./check/private-data.mjs";
import { validateContent } from "./check/schema.mjs";

const shownPath = process.argv[2] ?? "site/content.json";
const path = process.argv[2] ? resolve(process.argv[2]) : new URL("../site/content.json", import.meta.url);
const schemaPath = new URL("../site/content.schema.json", import.meta.url);

// The parsed content file, or why it could not be read, in plain words.
async function readContent() {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { unreadable: `There is no content file at ${shownPath}. The Analyst role writes it.` };
    throw error;
  }
  try {
    return { content: JSON.parse(text) };
  } catch (error) {
    return {
      unreadable: `${shownPath} is not valid JSON: ${error.message}. Look for a missing comma between two entries, a comma after the last entry of a list, or a missing quote.`,
    };
  }
}

function report(problems) {
  if (problems.length === 0) {
    console.log(`${shownPath} is ready: it matches the schema and has no phone number or postal address.`);
    return;
  }
  console.log(`${shownPath} has ${problems.length} thing${problems.length === 1 ? "" : "s"} to fix:\n`);
  for (const problem of problems) console.log(`  - ${problem}`);
}

try {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const { content, unreadable } = await readContent();
  if (unreadable) console.log(unreadable);
  else report([...validateContent(schema, content), ...findPrivateDataInContent(content)]);
} catch (error) {
  console.log(`The content file could not be checked: ${error.message}`);
}
// Always 0: this reports, it never gates.
process.exitCode = 0;
