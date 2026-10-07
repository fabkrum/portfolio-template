// The fonts the template brings along in fonts/, one folder per family, and
// what a design brief's Type table asks of them. A font first in a stack is
// either one every computer has, a bundled one the site can serve itself, or
// a web font that is not here: the page then shows the next font of the stack.
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { briefFonts, fontsIn, kindOfFont, sameFont } from "../brief/check-brief.mjs";

// Every family in fonts/: its name, its folder, the files the site needs
// (the fonts and their licence) and its @font-face rules, from font-face.css.
export async function bundledFonts(repoDir) {
  const fontsDir = join(repoDir, "fonts");
  if (!existsSync(fontsDir)) return [];
  const families = [];
  for (const entry of await readdir(fontsDir, { withFileTypes: true })) {
    const dir = join(fontsDir, entry.name);
    if (!entry.isDirectory() || !existsSync(join(dir, "font-face.css"))) continue;
    const rules = (await readFile(join(dir, "font-face.css"), "utf8")).replaceAll("\r\n", "\n");
    const name = rules.match(/font-family:\s*["']([^"']+)["']/)?.[1];
    if (!name) continue;
    const files = (await readdir(dir)).filter((file) => file.endsWith(".woff2") || file === "OFL.txt").sort();
    families.push({ name, folder: entry.name, dir, files, rules });
  }
  // In the same order on every computer, whatever its language.
  return families.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// The family in fonts/ of this font name, if it is bundled.
export const familyOf = (font, families) => families.find(({ name }) => sameFont(name, font));

// The first font of each row of the brief's Type table and its kind, as
// kindOfFont tells it: { role: "headings", font: "Newsreader", kind: "bundled",
// family }, with next, the font the page shows instead of a "web" font.
export function fontsOfBrief(brief, families) {
  const names = families.map(({ name }) => name);
  return Object.entries(briefFonts(brief))
    .map(([role, stack]) => [role, fontsIn(stack)])
    .filter(([, fonts]) => fonts.length > 0)
    .map(([role, [font, next]]) => ({ role, font, next, kind: kindOfFont(font, names), family: familyOf(font, families) }));
}

// The @font-face rules of these families, one family after the other, in the
// given line endings: Git on Windows may check a stylesheet out with CRLF.
export const fontFaceRules = (families, eol = "\n") =>
  families.map((family) => family.rules.trim().replaceAll("\n", eol)).join(eol + eol);

// Copies a family's fonts and licence into the site, as site/assets/fonts/<folder>/.
export async function copyIntoSite(repoDir, family) {
  const target = join(repoDir, "site", "assets", "fonts", family.folder);
  await mkdir(target, { recursive: true });
  for (const file of family.files) await copyFile(join(family.dir, file), join(target, file));
  return `site/assets/fonts/${family.folder}/`;
}
