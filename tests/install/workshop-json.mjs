// Says whether a repo holds the workshop.json the Install script writes for
// the event in WORKSHOP_EVENT, WORKSHOP_DATE and WORKSHOP_CITY: UTF-8 without
// a byte order mark, valid JSON, and exactly these values, leaving out an
// empty one. Without WORKSHOP_EVENT, there must be no workshop.json at all.
// It prints what it expected, and what it found instead, if anything; then
// it exits 1. assert-ready.sh and assert-ready.ps1 run it.
//
// Usage: node tests/install/workshop-json.mjs <repo-folder>
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

const file = join(process.argv[2], "workshop.json");
const { WORKSHOP_EVENT: event, WORKSHOP_DATE: date, WORKSHOP_CITY: city } = process.env;

// What was expected, and what was found instead (null if it was right).
function check() {
  if (!event) return { expected: "no workshop.json without an event", instead: existsSync(file) ? "there is one" : null };
  const values = { event, ...(date && { date }), ...(city && { city }) };
  const expected = `workshop.json holds exactly ${JSON.stringify(values)}`;
  if (!existsSync(file)) return { expected, instead: "there is none" };
  const bytes = readFileSync(file);
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return { expected, instead: "it starts with a byte order mark" };
  let found;
  try {
    found = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    return { expected, instead: `it is not valid UTF-8 JSON: ${error.message}` };
  }
  return { expected, instead: isDeepStrictEqual(found, values) ? null : `got ${JSON.stringify(found)}` };
}

const { expected, instead } = check();
console.log(instead ? `${expected} (${instead})` : expected);
if (instead) process.exitCode = 1;
