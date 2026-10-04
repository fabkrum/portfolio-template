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
import { applyCheckpoint, ROLES } from "./checkpoint/apply-checkpoint.mjs";

const repoDir = fileURLToPath(new URL("..", import.meta.url));

const BLOCKS = {
  analyst: { name: "Analyst", next: "the Designer", gives: "your content file and spec, or the sample person" },
  designer: { name: "Designer", next: "the Developer", gives: "your design brief, or the default design" },
  developer: { name: "Developer", next: "QA", gives: "the site, built in the colours and fonts of your brief" },
  qa: { name: "QA", next: "the Lawyer", gives: "the site, checked" },
  lawyer: { name: "Lawyer", next: "Ops", gives: "the privacy page, written for you" },
  ops: { name: "Ops", next: "Ops", gives: "the same as the Lawyer's: Ops publishes and changes no file" },
};

function listCheckpoints() {
  console.log("Run it with the role whose block the room has just finished:\n");
  for (const role of ROLES) console.log(`  node tools/checkpoint.mjs ${role.padEnd(9)}  ${BLOCKS[role].gives}`);
  console.log("\nA checkpoint keeps your own content file, design brief and spec. Nothing was changed.");
}

const KEPT = {
  "site/content.json": (result, sample) =>
    sample ? `still the sample person, ${result.name}. The Analyst replaces it with yours.` : `your content${result.name ? `, for ${result.name}` : ""}`,
  "design/brief.md": (result, sample) => (sample ? "the default design brief" : "your design brief"),
  "docs/spec.md": (result, sample) => (sample ? "still the spec of the sample person. The Analyst replaces it with yours." : "your spec"),
  "site/privacy.html": () => "your privacy page",
};

const PUT_IN = {
  "site/content.json": (result) => `the sample person, ${result.name}. The Analyst replaces it with yours.`,
  "design/brief.md": () => "the default design brief. The Designer replaces it with yours.",
  "docs/spec.md": () => "the spec of the sample person. The Analyst replaces it with yours.",
};

function changedNote(file, result, role) {
  if (file === "site/assets/styles.css" && ["developer", "qa", "lawyer", "ops"].includes(role)) {
    if (!result.styled) return "the Developer's stylesheet, in the default colours and fonts";
    return result.styled.ownBrief
      ? "the Developer's stylesheet, in the colours and fonts of your design brief"
      : "the Developer's stylesheet, in the default design";
  }
  if (file === "site/privacy.html") {
    if (!result.privacy) return "the placeholder: the Lawyer writes the real page";
    const { NAME, EMAIL } = result.privacy;
    if (NAME && EMAIL) return `the privacy page for ${NAME}, with the email address ${EMAIL}, dated today`;
    return "the privacy page, with blanks still to fill in";
  }
  return "";
}

function attention(result, role) {
  const notes = [];
  const languageName = (code) => {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  if (result.unreadable) {
    notes.push(
      `site/content.json is not valid JSON, so your site cannot show your content: ${result.unreadable}. ` +
        "The Analyst fixes it in a fresh chat. To go on with the sample person instead, delete site/content.json and run this command again.",
    );
  }
  if (result.briefProblems.length > 0) {
    const effect = result.styled === false && ["developer", "qa", "lawyer", "ops"].includes(role)
      ? "so your site keeps the default colours and fonts"
      : "so the Developer cannot build from it yet";
    notes.push(
      [
        `design/brief.md is not finished, ${effect}:`,
        ...result.briefProblems.map((problem) => `    - ${problem}`),
        "    The Designer finishes it in a fresh chat; say default there to use the default design. Then run this command again.",
      ].join("\n"),
    );
  }
  for (const font of result.styled?.webFonts ?? []) {
    notes.push(
      `Your design brief names the font "${font}". This checkpoint does not load it, so your site shows the next font in the list instead. The Developer can add it in a fresh chat.`,
    );
  }
  if (result.privacy && result.changed.includes("site/privacy.html")) {
    if (!result.privacy.EMAIL) {
      notes.push(
        "Your content file has no email address, so the privacy page still has a blank for it: the law asks for a way to reach whoever runs the site. The Lawyer asks you for one in a fresh chat.",
      );
    }
    if (!result.language.startsWith("en")) {
      notes.push(`Your site is in ${languageName(result.language)}, but the privacy page is in English. The Lawyer translates it in a fresh chat.`);
    }
  }
  return notes;
}

function report(result, role) {
  const block = BLOCKS[role];
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
    for (const file of result.changed) {
      const note = changedNote(file, result, role);
      console.log(`  ${file}${note ? ` – ${note}` : ""}`);
    }
  }
  const notes = attention(result, role);
  if (notes.length > 0) {
    console.log("\nNeeds your attention:");
    for (const note of notes) console.log(`  - ${note}`);
  }
  if (role === "ops") console.log("\nOps changes no file, so this is the same as the Lawyer's checkpoint. Your site goes live once Ops publishes it.");
  console.log(`\nNext: start a fresh chat and ask for ${block.next}.`);
  console.log("To see your site, run node tools/preview.mjs and open the address it prints in Chrome.");
}

const role = process.argv[2];
const nodeMajor = Number(process.versions.node.split(".")[0]);

if (nodeMajor < 22) {
  console.log(`This needs Node 22 or newer; this is Node ${process.versions.node}.`);
  console.log("Run the install script again, or install the current Node LTS from nodejs.org.");
  process.exitCode = 1;
} else if (!role) {
  console.log("Which checkpoint?");
  listCheckpoints();
} else if (!ROLES.includes(role)) {
  console.log(`There is no checkpoint called "${role}".`);
  listCheckpoints();
  process.exitCode = 1;
} else {
  try {
    report(await applyCheckpoint(repoDir, role), role);
  } catch (error) {
    console.log(`The checkpoint could not be applied: ${error.message}.`);
    console.log("Nothing you made is lost: your content file, design brief and spec are never overwritten. Ask the instructor for help.");
    process.exitCode = 1;
  }
}
