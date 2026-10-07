// Reads the content file of a site folder, the same way for the Check and the
// build. A byte order mark at the start, which some Windows editors write, is
// fine: browsers ignore it too.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// A value from the content file, if it is text with something in it.
export const filledText = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

// { content }, or { unreadable } with the reason in plain words.
export async function readContentFile(siteDir) {
  let source;
  try {
    source = await readFile(join(siteDir, "content.json"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { unreadable: "There is no content.json in the site folder. The Analyst role writes it." };
    return { unreadable: `content.json could not be read: ${error.message}` };
  }
  let content;
  try {
    content = JSON.parse(source.replace(/^\uFEFF/, ""));
  } catch (error) {
    return {
      unreadable: `content.json is not valid JSON: ${error.message}. Look for a missing comma between two entries, a comma after the last entry of a list, or a missing quote.`,
    };
  }
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return { unreadable: 'content.json must hold one object in curly braces, such as { "name": "Ada Example", … }.' };
  }
  return { content };
}
