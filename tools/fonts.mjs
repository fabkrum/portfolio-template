// Puts the fonts of your design brief into your site. The Developer role runs
// it from your repo folder:
//
//   node tools/fonts.mjs
//
// The template brings two openly licensed fonts per style along, in fonts/.
// This copies each one the Type table of design/brief.md names into
// site/assets/fonts/, with its licence, and prints the @font-face rules for
// site/assets/styles.css. It downloads nothing: the site serves its fonts
// itself and loads nothing from other servers.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundledFonts, copyIntoSite, fontFaceRules, fontsOfBrief } from "./fonts/bundled-fonts.mjs";

const repoDir = fileURLToPath(new URL("..", import.meta.url));

// The rows of the Type table per font, in the order the brief names them.
function byFont(fonts) {
  const grouped = new Map();
  for (const entry of fonts) {
    const key = entry.font.toLowerCase();
    grouped.set(key, { ...entry, roles: [...(grouped.get(key)?.roles ?? []), entry.role] });
  }
  return [...grouped.values()];
}

async function run() {
  let brief;
  try {
    brief = await readFile(new URL("../design/brief.md", import.meta.url), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    console.log("There is no design brief at design/brief.md. The Designer role writes it.");
    return;
  }
  const families = await bundledFonts(repoDir);
  const fonts = byFont(fontsOfBrief(brief, families));
  if (fonts.length === 0) {
    console.log("design/brief.md names no fonts in its Type table. Run node tools/check-brief.mjs: it says what to fix.");
    return;
  }

  console.log("The fonts in design/brief.md:\n");
  const copied = [];
  for (const { font, roles, kind, family, next } of fonts) {
    const where = `${font} (${roles.join(", ")})`;
    if (kind === "bundled") {
      console.log(`  ${where} – copied into ${await copyIntoSite(repoDir, family)}, with its licence.`);
      copied.push(family);
    } else if (kind === "system") {
      console.log(`  ${where} – a font every computer has: nothing to copy.`);
    } else {
      console.log(
        `  "${font}" (${roles.join(", ")}) – not one of the fonts in fonts/. Unless its files are already in site/assets/fonts/, the site cannot load it, and the page shows the next font of its stack${next ? `, ${next}` : ""}. The Designer can choose one of the bundled fonts in a fresh chat.`,
      );
    }
  }
  if (copied.length > 0) {
    console.log("\nPut these rules at the top of site/assets/styles.css, before everything else, exactly as they are:\n");
    console.log(fontFaceRules(copied));
  }
}

try {
  await run();
} catch (error) {
  console.log(`The fonts could not be copied: ${error.message}`);
}
// Always 0: this reports, it never gates.
process.exitCode = 0;
