// Jump to a checkpoint. Run it from your repo folder, with the role whose
// block the room has just finished:
//
//   node tools/checkpoint.mjs developer
//
// It brings your site to the end of that block, so you are back in step with
// the room. It keeps your own content file, design brief and spec; if you
// have none, it puts in the sample person, the default design and the sample
// spec. It needs no Git.
import { fileURLToPath } from "node:url";
import { applyCheckpoint, BLOCKS } from "./checkpoint/apply-checkpoint.mjs";

const repoDir = fileURLToPath(new URL("..", import.meta.url));

// Each block: its name, the role that comes next, and what its checkpoint gives you.
const ABOUT = {
  analyst: { name: "Analyst", next: "the Designer", gives: "your content file and spec, or the sample person" },
  designer: { name: "Designer", next: "the Developer", gives: "your design brief, or the default design" },
  developer: { name: "Developer", next: "QA", gives: "the site, built in the colours and fonts of your brief" },
  qa: { name: "QA", next: "the Lawyer", gives: "the site, checked" },
  lawyer: { name: "Lawyer", next: "Ops", gives: "the legal page, written for you" },
  ops: { name: "Ops", next: "Ops", gives: "the same as the Lawyer's: Ops publishes and changes no file" },
};

function listCheckpoints() {
  console.log("Run it with the role whose block the room has just finished:\n");
  for (const block of BLOCKS) console.log(`  node tools/checkpoint.mjs ${block.padEnd(9)}  ${ABOUT[block].gives}`);
  console.log("\nA checkpoint keeps your own content file, design brief and spec. Nothing was changed.");
}

const KEPT = {
  "site/content.json": (result, sample) =>
    sample ? `still the sample person, ${result.name}. The Analyst replaces it with yours.` : `your content${result.name ? `, for ${result.name}` : ""}`,
  "design/brief.md": (result, sample) => (sample ? "the default design brief" : "your design brief"),
  "docs/spec.md": (result, sample) => (sample ? "still the spec of the sample person. The Analyst replaces it with yours." : "your spec"),
  "site/privacy.html": () => "your legal page",
};

const PUT_IN = {
  "site/content.json": (result) => `the sample person, ${result.name}. The Analyst replaces it with yours.`,
  "design/brief.md": () => "the default design brief. The Designer replaces it with yours.",
  "docs/spec.md": () => "the spec of the sample person. The Analyst replaces it with yours.",
};

// What each file of a checkpoint is, in the list of files it changed.
const FILE_NOTES = {
  "site/index.html": "the page itself, with a place for each section",
  "site/assets/main.js": "the place for small extras in JavaScript; your content is in the page without it",
  "site/assets/render.js": "turns your content file into the sections of the page when the site is built",
  "site/assets/styles.css": "the plain starting styles of the template",
  "site/assets/favicon.svg": "the small icon in the browser tab",
  "site/assets/avatar.svg": "the drawing that stands in for the sample person's photo",
  "site/content.schema.json": "what your content file may contain",
  "site/privacy.html": "the placeholder: the Lawyer writes the legal page",
  "design/default-brief.md": "the default design brief, kept so you can always go back to it",
};

function changedNote(file, result) {
  const { stylesheet, privacy } = result;
  if (file.startsWith("site/assets/fonts/")) {
    return file.endsWith("/OFL.txt") ? "the licence of the font beside it" : "a font of the design, served from your own site";
  }
  if (file === "site/assets/styles.css" && stylesheet) {
    if (!stylesheet.fromBrief) return "the Developer's stylesheet, in the default colours and fonts";
    if (!stylesheet.ownBrief) return "the Developer's stylesheet, in the default design";
    return stylesheet.unusableFonts.length > 0
      ? "the Developer's stylesheet, in the colours of your design brief and the default fonts"
      : "the Developer's stylesheet, in the colours and fonts of your design brief";
  }
  if (file === "site/privacy.html" && privacy) {
    return privacy.NAME && privacy.EMAIL
      ? `the legal page for ${privacy.NAME}, with the email address ${privacy.EMAIL}, dated today`
      : "the legal page, with blanks still to fill in";
  }
  return FILE_NOTES[file] ?? `as it is at the end of the ${ABOUT[result.block].name} block`;
}

const languageName = (code) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

function attention(result) {
  const notes = [];
  const list = (lines) => lines.map((line) => `    - ${line}`);
  if (result.unreadable) {
    notes.push(
      `site/content.json is not valid JSON, so your site cannot show your content: ${result.unreadable}. ` +
        "The Analyst fixes it in a fresh chat. To go on with the sample person instead, delete site/content.json and run this command again.",
    );
  }
  if (result.briefProblems.length > 0) {
    const effect = result.stylesheet ? "so your site keeps the default colours and fonts" : "so the Developer cannot build from it yet";
    notes.push(
      [
        `design/brief.md is not finished, ${effect}:`,
        ...list(result.briefProblems),
        "    The Designer finishes it in a fresh chat; say default there to use the default design. Then run this command again.",
      ].join("\n"),
    );
  }
  for (const fonts of result.stylesheet?.unusableFonts ?? []) {
    notes.push(
      `The fonts in your design brief, "${fonts}", are not a list of font names, so your site keeps the default fonts. The Designer can correct them in a fresh chat; then run this command again.`,
    );
  }
  for (const font of result.stylesheet?.webFonts ?? []) {
    notes.push(
      `Your design brief names the font "${font}". This checkpoint does not load it, so your site shows the next font in the list instead. The Developer can add it in a fresh chat.`,
    );
  }
  if (result.privacy && result.changed.includes("site/privacy.html")) {
    notes.push(
      "The legal page comes from a template for a personal portfolio in the EU that has no tracking: a legal notice, a privacy notice and an accessibility statement. It is not legal advice: if you sell services through the site or run it as a business, ask someone who knows the law in your country.",
    );
    if (!result.privacy.address) {
      notes.push(
        "Your legal notice shows your name and email address. If your site offers services, the law also asks for a postal address, and in Italy for your Partita IVA: the Lawyer adds them in a fresh chat.",
      );
    }
    if (!result.privacy.EMAIL && !result.unreadable) {
      notes.push(
        "Your content file has no email address, so the legal page still has a blank for it: the law asks for a way to reach whoever runs the site. The Lawyer asks you for one in a fresh chat.",
      );
    }
    if (!result.language.startsWith("en")) {
      notes.push(`Your site is in ${languageName(result.language)}, but the legal page is in English. The Lawyer translates it in a fresh chat.`);
    }
  }
  return notes;
}

function report(result) {
  const block = ABOUT[result.block];
  const nothing = result.changed.length === 0 && result.putIn.length === 0;
  console.log(
    nothing
      ? `Nothing to change: your site is already at the end of the ${block.name} block.`
      : `Your site is now at the end of the ${block.name} block.`,
  );
  if (result.kept.length > 0) {
    console.log("\nKept as they are:");
    for (const { file, sample } of result.kept) console.log(`  ${file} – ${KEPT[file](result, sample)}`);
  }
  if (result.putIn.length > 0) {
    console.log("\nPut in, because you had none:");
    for (const file of result.putIn) console.log(`  ${file} – ${PUT_IN[file](result)}`);
  }
  if (result.changed.length > 0) {
    console.log("\nChanged:");
    for (const file of result.changed) console.log(`  ${file} – ${changedNote(file, result)}`);
  }
  const notes = attention(result);
  if (notes.length > 0) {
    console.log("\nNeeds your attention:");
    for (const note of notes) console.log(`  - ${note}`);
  }
  if (result.block === "ops") console.log("\nOps changes no file, so this is the same as the Lawyer's checkpoint. Your site goes live once Ops publishes it.");
  console.log(`\nNext: start a fresh chat and ask for ${block.next}.`);
  console.log("To see your site, run node tools/preview.mjs and open the address it prints in Chrome.");
}

const block = process.argv[2];
const nodeMajor = Number(process.versions.node.split(".")[0]);

if (nodeMajor < 22) {
  console.log(`This needs Node 22 or newer; this is Node ${process.versions.node}.`);
  console.log("Run the install script again, or install the current Node LTS from nodejs.org.");
  process.exitCode = 1;
} else if (!block) {
  console.log("Which checkpoint?");
  listCheckpoints();
} else if (!BLOCKS.includes(block)) {
  console.log(`There is no checkpoint called "${block}".`);
  listCheckpoints();
  process.exitCode = 1;
} else {
  try {
    report(await applyCheckpoint(repoDir, block));
  } catch (error) {
    console.log(`The checkpoint could not be applied: ${error.message}.`);
    console.log("Nothing you made is lost: your content file, design brief and spec are never overwritten. Ask the instructor for help.");
    process.exitCode = 1;
  }
}
