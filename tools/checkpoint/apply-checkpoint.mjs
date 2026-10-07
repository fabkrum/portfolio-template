// Applies a checkpoint: brings the repo to the end of one block of the
// workshop and keeps what is the person's own. Each folder in checkpoints/
// holds what its block adds, laid over the folders of the blocks before it.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { briefColours, briefFonts, checkBrief, firstFont, SYSTEM_FONTS, TOKENS } from "../brief/check-brief.mjs";
import { bundledFonts } from "../fonts/bundled-fonts.mjs";
import { findPrivateDataInContent } from "../check/private-data.mjs";
import { privacyPageProblems } from "../check/run-check.mjs";

// The blocks of the workshop, in order, each named after the role that fills
// it. There is one checkpoint per block.
export const BLOCKS = ["analyst", "designer", "developer", "qa", "lawyer", "ops"];

// Whether the end of this block is the end of that one or later.
const reached = (block, that) => BLOCKS.indexOf(block) >= BLOCKS.indexOf(that);

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
export async function sourcesUpTo(repoDir, block) {
  const sources = new Map();
  for (const earlier of BLOCKS.slice(0, BLOCKS.indexOf(block) + 1)) {
    const checkpointDir = join(repoDir, "checkpoints", earlier);
    if (!existsSync(checkpointDir)) throw new Error(`the folder checkpoints/${earlier} is missing from your repo`);
    for (const file of await filesOf(checkpointDir)) sources.set(file, join(checkpointDir, file));
  }
  return sources;
}

export async function readContent(path) {
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

// A value from the content file, if it is text with something in it.
export const nonEmpty = (value) => (typeof value === "string" && value.trim() ? value : undefined);

// What the Lawyer fills into the blanks of the privacy page, from the content
// file. The page is in English, so its language is English too. A value the
// content file does not give stays a blank.
function privacyBlanks(content) {
  const mailto = Array.isArray(content.links)
    ? content.links.map((link) => nonEmpty(link?.url)).find((url) => url?.startsWith("mailto:"))
    : undefined;
  const language = nonEmpty(content.language) ?? "en";
  return {
    NAME: nonEmpty(content.name),
    EMAIL: nonEmpty(mailto?.slice("mailto:".length).split("?")[0]),
    LANGUAGE: language.startsWith("en") ? language : "en",
    DATE: writtenOut(new Date()),
  };
}

const fillBlanks = (page, blanks) => page.replace(/\[\[([A-Z_]+)\]\]/g, (blank, key) => (blanks[key] ? escapeHtml(blanks[key]) : blank));

// A privacy page the Lawyer has written for the person in the content file is
// theirs as well: it may be translated or changed by hand. While the content
// file cannot be read, any written page counts as theirs.
export const writtenFor = (page, { name, unreadable }) =>
  privacyPageProblems(page).length === 0 && (unreadable || (Boolean(name) && (page.includes(name) || page.includes(escapeHtml(name)))));

// A font stack from the brief's Type table, maybe written in backticks. It is
// used only if it holds nothing but names, quotes, commas and spaces, so it can
// never break out of its line in the stylesheet; otherwise null.
function fontStack(cell) {
  const stack = cell.trim().replace(/^`(.*)`$/, "$1").trim();
  return /^[\p{L}\p{N} "',._-]+$/u.test(stack) ? stack : null;
}

// The Developer's stylesheet in the six colours of a brief that is ready for
// the Developer, and in its fonts where its font stacks can be used. The rest
// stays the default design.
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
  const unusableFonts = [];
  // Dates and labels take the brief's details font, or its body font in a brief without one.
  for (const [property, cell] of [["--font-heading", fonts.headings], ["--font-body", fonts.body], ["--font-details", fonts.details ?? fonts.body]]) {
    const stack = fontStack(cell);
    if (stack) styled = styled.replace(new RegExp(`(${property}\\s*:\\s*)[^;]+`), (_, start) => `${start}${stack}`);
    else unusableFonts.push(cell);
  }
  return { css: styled, unusableFonts: [...new Set(unusableFonts)] };
}

// The Developer's stylesheet: in the colours and fonts of a brief that is
// ready, otherwise the default design. On top come the @font-face rules of the
// bundled fonts in fonts/ that its font stacks start with, as node
// tools/fonts.mjs gives them to the Developer; the site needs their files too.
// webFonts: the other fonts its stacks start with that no computer has.
async function developersStylesheet(repoDir, css, brief) {
  const styled = brief ? styledByBrief(css, brief) : { css, unusableFonts: [] };
  const firsts = [...new Set([...styled.css.matchAll(/--font-[\w-]+\s*:\s*([^;]+);/g)].map(([, stack]) => firstFont(stack)))];
  const families = (await bundledFonts(repoDir)).filter(({ name }) => firsts.some((font) => font.toLowerCase() === name.toLowerCase()));
  // In the stylesheet's own line endings: Git on Windows may check it out with CRLF.
  const eol = styled.css.includes("\r\n") ? "\r\n" : "\n";
  const rules = families.map((family) => family.rules.trim().replaceAll("\n", eol));
  return {
    css: rules.length > 0 ? `${rules.join(eol + eol)}${eol}${eol}${styled.css}` : styled.css,
    families,
    unusableFonts: styled.unusableFonts,
    webFonts: firsts.filter(
      (font) => font && !SYSTEM_FONTS.has(font.toLowerCase()) && !families.some(({ name }) => name.toLowerCase() === font.toLowerCase()),
    ),
  };
}

// Brings the repo in repoDir to the end of this block, and says what it kept,
// what it put in for a file of the person's own they did not have, what it
// changed, and what it found about the person's own files on the way.
export async function applyCheckpoint(repoDir, block) {
  const sources = await sourcesUpTo(repoDir, block);
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
  if (existsSync(privacyPath) && writtenFor(await readFile(privacyPath, "utf8"), { name: nonEmpty(content.name), unreadable })) {
    kept.push({ file: "site/privacy.html" });
    sources.delete("site/privacy.html");
  }

  const ownBrief = kept.find((own) => own.file === "design/brief.md");
  const brief = await readFile(sources.get("design/brief.md") ?? join(repoDir, "design", "brief.md"), "utf8");
  const briefProblems = checkBrief(brief);
  const styledByOwnBrief = reached(block, "developer") && briefProblems.length === 0;
  const privacy = reached(block, "lawyer") ? privacyBlanks(content) : null;

  // From the Developer's block on, the stylesheet's fonts come along, each with its licence.
  const stylesheet = reached(block, "developer")
    ? await developersStylesheet(repoDir, await readFile(sources.get("site/assets/styles.css"), "utf8"), styledByOwnBrief ? brief : null)
    : null;
  for (const family of stylesheet?.families ?? []) {
    for (const file of family.files) sources.set(`site/assets/fonts/${family.folder}/${file}`, join(family.dir, file));
  }

  const changed = [];
  for (const [file, source] of sources) {
    let bytes = await readFile(source);
    if (file === "site/privacy.html" && privacy) bytes = Buffer.from(fillBlanks(bytes.toString("utf8"), privacy));
    if (file === "site/assets/styles.css" && stylesheet) bytes = Buffer.from(stylesheet.css);
    const target = join(repoDir, file);
    if (existsSync(target) && (await readFile(target)).equals(bytes)) continue;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    if (!putIn.includes(file)) changed.push(file);
  }

  return {
    block,
    kept,
    putIn,
    changed,
    name: nonEmpty(content.name),
    language: nonEmpty(content.language) ?? "en",
    unreadable,
    briefProblems,
    // How the Developer's stylesheet looks, from the Developer's block on: in
    // the colours and fonts of the brief, unless it is not ready.
    stylesheet: reached(block, "developer")
      ? {
          fromBrief: styledByOwnBrief,
          ownBrief: Boolean(ownBrief) && !ownBrief.sample,
          unusableFonts: stylesheet.unusableFonts,
          webFonts: styledByOwnBrief ? stylesheet.webFonts : [],
        }
      : null,
    privacy,
    privateData: reached(block, "lawyer") && !unreadable ? findPrivateDataInContent(content) : [],
  };
}
