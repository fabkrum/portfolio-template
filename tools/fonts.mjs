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
import { bundledFonts, copyIntoSite, fontsOfBrief } from "./fonts/bundled-fonts.mjs";

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
  const rules = [];
  for (const { font, roles, family, system, next } of fonts) {
    const where = `${font} (${roles.join(", ")})`;
    if (family) {
      console.log(`  ${where} – copied into ${await copyIntoSite(repoDir, family)}, with its licence.`);
      rules.push(family.rules.trim());
    } else if (system) {
      console.log(`  ${where} – a font every computer has: nothing to copy.`);
    } else {
      console.log(
        `  "${font}" (${roles.join(", ")}) – not one of the fonts in fonts/, so the site cannot load it: the page shows the next font of its stack${next ? `, ${next}` : ""}. Leave "${font}" out of that stack in the CSS. The Designer can choose one of the bundled fonts in a fresh chat.`,
      );
    }
  }
  if (rules.length > 0) {
    console.log("\nPut these rules at the top of site/assets/styles.css, before everything else, exactly as they are:\n");
    console.log(rules.join("\n\n"));
  }
}

try {
  await run();
} catch (error) {
  console.log(`The fonts could not be copied: ${error.message}`);
}
// Always 0: this reports, it never gates.
process.exitCode = 0;
