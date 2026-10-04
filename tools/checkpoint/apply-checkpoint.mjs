// Applies a checkpoint: brings the repo to the end of one block of the
// workshop and keeps what is the person's own. Each folder in checkpoints/
// holds what its block adds, laid over the folders of the blocks before it.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { briefColours, briefFonts, checkBrief, TOKENS } from "../brief/check-brief.mjs";
import { privacyPageProblems } from "../check/run-check.mjs";

// One checkpoint per block, in the order of the blocks.
export const ROLES = ["analyst", "designer", "developer", "qa", "lawyer", "ops"];
const reached = (role, block) => ROLES.indexOf(role) >= ROLES.indexOf(block);

// A checkpoint writes only into these folders of the repo.
const PARTS = ["site", "design", "docs"];

// The person's own files. A checkpoint never overwrites them; its copies are
// the sample person, the default brief and the sample spec, for whoever has none.
const OWN_FILES = ["site/content.json", "design/brief.md", "docs/spec.md"];

// The files a checkpoint folder holds, as repo paths such as "site/index.html".
async function filesOf(checkpointDir) {
  const files = [];
  for (const part of PARTS) {
    const partDir = join(checkpointDir, part);
    if (!existsSync(partDir)) continue;
    for (const entry of await readdir(partDir, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) files.push(relative(checkpointDir, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
    }
  }
  return files;
}

// Every file the checkpoint has, by repo path, from the folder of the latest
// block that holds it.
async function sourcesUpTo(repoDir, role) {
  const sources = new Map();
  for (const block of ROLES.slice(0, ROLES.indexOf(role) + 1)) {
    const checkpointDir = join(repoDir, "checkpoints", block);
    if (!existsSync(checkpointDir)) throw new Error(`the folder checkpoints/${block} is missing from your repo`);
    for (const file of await filesOf(checkpointDir)) sources.set(file, join(checkpointDir, file));
  }
  return sources;
}

async function readContent(path) {
  try {
    const content = JSON.parse(await readFile(path, "utf8"));
    return { content: content && typeof content === "object" ? content : {} };
  } catch (error) {
    return { content: {}, unreadable: error.message };
  }
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const writtenOut = (date) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
const text = (value) => (typeof value === "string" && value.trim() ? value : undefined);

// What the Lawyer fills into the blanks of the privacy page, from the content
// file. The page is in English, so its language is English too. A value the
// content file does not give stays a blank.
function privacyBlanks(content) {
  const mailto = Array.isArray(content.links)
    ? content.links.map((link) => text(link?.url)).find((url) => url?.startsWith("mailto:"))
    : undefined;
  const language = text(content.language) ?? "en";
  return {
    NAME: text(content.name),
    EMAIL: text(mailto?.slice("mailto:".length).split("?")[0]),
    LANGUAGE: language.startsWith("en") ? language : "en",
    DATE: writtenOut(new Date()),
  };
}

const fillBlanks = (page, blanks) => page.replace(/\[\[([A-Z_]+)\]\]/g, (blank, key) => (blanks[key] ? escapeHtml(blanks[key]) : blank));

// A privacy page the Lawyer has written for the person in the content file is
// theirs as well: it may be translated or changed by hand.
const writtenFor = (page, name) =>
  Boolean(name) && privacyPageProblems(page).length === 0 && (page.includes(name) || page.includes(escapeHtml(name)));

// Only names, quotes, commas and spaces: a font stack can never break out of
// its line in the stylesheet.
const FONT_STACK = /^[\w "',.-]+$/;

// The Developer's stylesheet with the six colours and the two font stacks of
// a brief that is ready for the Developer. The rest stays the default design.
function styledByBrief(css, brief) {
  const colours = briefColours(brief);
  let styled = css;
  for (const token of TOKENS) {
    styled = styled.replace(
      new RegExp(`(?<![\\w-])(--${token}\\s*:\\s*)light-dark\\([^)]*\\)`),
      (_, start) => `${start}light-dark(${colours.Light[token]}, ${colours.Dark[token]})`,
    );
  }
  const fonts = briefFonts(brief);
  for (const [property, stack] of [["--font-heading", fonts.headings], ["--font-body", fonts.body]]) {
    if (!FONT_STACK.test(stack)) continue;
    styled = styled.replace(new RegExp(`(${property}\\s*:\\s*)[^;]+`), (_, start) => `${start}${stack}`);
  }
  return styled;
}

// Fonts every computer has, and the generic families. Any other font first in
// a stack is a web font: it shows only once the Developer adds its files.
const SYSTEM_FONTS = new Set([
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "sans-serif", "serif", "monospace",
  "cursive", "fantasy", "-apple-system", "blinkmacsystemfont", "segoe ui", "helvetica", "helvetica neue", "arial",
  "arial rounded mt bold", "verdana", "tahoma", "trebuchet ms", "georgia", "times new roman", "times",
  "courier new", "courier", "menlo", "monaco", "consolas",
]);
const firstFont = (stack) => stack.split(",")[0].trim().replace(/^["']|["']$/g, "");

function webFontsIn(brief) {
  const firsts = Object.values(briefFonts(brief)).filter((stack) => FONT_STACK.test(stack)).map(firstFont);
  return [...new Set(firsts)].filter((font) => font && !SYSTEM_FONTS.has(font.toLowerCase()));
}

// Brings the repo in repoDir to the end of the block of this role, and says
// what it kept, what it put in for a missing file of the person's own, what
// it changed, and what it found about the person's own files.
export async function applyCheckpoint(repoDir, role) {
  const sources = await sourcesUpTo(repoDir, role);
  const kept = [];
  const putIn = [];
  for (const file of OWN_FILES) {
    if (!existsSync(join(repoDir, file))) {
      putIn.push(file);
      continue;
    }
    const sample = sources.get(file);
    kept.push({ file, sample: Boolean(sample) && (await readFile(join(repoDir, file))).equals(await readFile(sample)) });
    sources.delete(file);
  }

  const { content, unreadable } = await readContent(sources.get("site/content.json") ?? join(repoDir, "site", "content.json"));
  const privacyPath = join(repoDir, "site", "privacy.html");
  if (existsSync(privacyPath) && writtenFor(await readFile(privacyPath, "utf8"), text(content.name))) {
    kept.push({ file: "site/privacy.html" });
    sources.delete("site/privacy.html");
  }

  const briefFile = kept.find((own) => own.file === "design/brief.md");
  const brief = await readFile(sources.get("design/brief.md") ?? join(repoDir, "design", "brief.md"), "utf8");
  const briefProblems = checkBrief(brief);
  const styled = reached(role, "developer") && briefProblems.length === 0;
  const privacy = reached(role, "lawyer") ? privacyBlanks(content) : null;

  const changed = [];
  for (const [file, source] of sources) {
    let bytes = await readFile(source);
    if (file === "site/privacy.html" && privacy) bytes = Buffer.from(fillBlanks(bytes.toString("utf8"), privacy));
    if (file === "site/assets/styles.css" && styled) bytes = Buffer.from(styledByBrief(bytes.toString("utf8"), brief));
    const target = join(repoDir, file);
    if (existsSync(target) && (await readFile(target)).equals(bytes)) continue;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    if (!putIn.includes(file)) changed.push(file);
  }

  return {
    kept,
    putIn,
    changed,
    name: text(content.name),
    language: text(content.language) ?? "en",
    unreadable,
    briefProblems,
    styled: styled && { ownBrief: Boolean(briefFile) && !briefFile.sample, webFonts: webFontsIn(brief) },
    privacy,
  };
}
