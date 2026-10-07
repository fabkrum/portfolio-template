// The fonts the template brings along in fonts/, one folder per family, and
// what a design brief's Type table asks of them. A font first in a stack is
// either one every computer has, a bundled one the site can serve itself, or
// a web font that is not here: the page then shows the next font of the stack.
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { briefFonts, firstFont, SYSTEM_FONTS } from "../brief/check-brief.mjs";

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
  return families.sort((a, b) => a.name.localeCompare(b.name));
}

// The first font of each row of the brief's Type table, and what it is:
// { role: "headings", font: "Newsreader", family } for a bundled font,
// { role, font, system: true } for one every computer has, { role, font, next }
// otherwise, with next the font the page shows instead.
export function fontsOfBrief(brief, families) {
  return Object.entries(briefFonts(brief))
    .map(([role, stack]) => ({ role, font: firstFont(stack), next: firstFont(stack.split(",").slice(1).join(",")) }))
    .filter(({ font }) => font)
    .map(({ role, font, next }) => {
      if (SYSTEM_FONTS.has(font.toLowerCase())) return { role, font, system: true };
      const family = families.find(({ name }) => name.toLowerCase() === font.toLowerCase());
      return family ? { role, font, family } : { role, font, next };
    });
}

// Copies a family's fonts and licence into the site, as site/assets/fonts/<folder>/.
export async function copyIntoSite(repoDir, family) {
  const target = join(repoDir, "site", "assets", "fonts", family.folder);
  await mkdir(target, { recursive: true });
  for (const file of family.files) await copyFile(join(family.dir, file), join(target, file));
  return `site/assets/fonts/${family.folder}/`;
}
