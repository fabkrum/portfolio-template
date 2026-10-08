// The legal page, site/privacy.html: the template next to this file with its
// blanks filled in from the content file. One function writes it for both
// node tools/legal.mjs, which the Developer runs, and the checkpoints from
// the Developer's block on, so the page is the same whichever way it comes.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../build/html.mjs";
import { legalPageProblems, telLinkOf } from "../check/run-check.mjs";

// The template: a legal notice, a privacy notice and an accessibility
// statement for a personal portfolio in the EU without tracking, in English,
// with [[BLANKS]] for what comes from the content file.
export const TEMPLATE_PATH = fileURLToPath(new URL("./privacy-template.html", import.meta.url));

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const writtenOut = (date) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

// A value from the content file, if it is text with something in it.
export const nonEmpty = (value) => (typeof value === "string" && value.trim() ? value : undefined);

// The legal page's sentence about barriers when the Check found none, word
// for word as it goes into the blank [[BARRIERS]].
export const NO_KNOWN_BARRIERS =
  "No barriers are known. Automatic tests cannot find every barrier, so if you meet one, please tell me.";

// What goes into the blanks of the legal page, from the content file. The
// page is in English, so its language is English too. A value the content
// file does not give stays a blank; "photo" says whether the page has the
// section about the person's photo, and address, phone and vat give the
// legal notice's optional lines.
export function legalBlanks(content, today = new Date()) {
  const mailto = Array.isArray(content.links)
    ? content.links.map((link) => nonEmpty(link?.url)).find((url) => url?.startsWith("mailto:"))
    : undefined;
  const language = nonEmpty(content.language) ?? "en";
  return {
    NAME: nonEmpty(content.name),
    EMAIL: nonEmpty(mailto?.slice("mailto:".length).split("?")[0]),
    LANGUAGE: language.startsWith("en") ? language : "en",
    DATE: writtenOut(today),
    BARRIERS: NO_KNOWN_BARRIERS,
    photo: Boolean(nonEmpty(content.photo?.src)),
    address: nonEmpty(content.legal?.address),
    phone: telLinkOf(content),
    vat: nonEmpty(content.legal?.vatId),
  };
}

// The legal page's section about the person's photo, word for word as it
// goes in for the blank [[PHOTO]] where the content file has a photo;
// elsewhere the blank's line goes.
export const PHOTO_SECTION = `      <section class="section">
        <h2>My photo</h2>
        <p>This site shows a photo of me. Like everything else on the site, it comes from this website, so showing it sends your data to no one else. It holds none of the hidden data a phone saves in a photo, such as where and when it was taken. Please do not use it anywhere else without asking me.</p>
      </section>`;
const PHOTO_BLANK = /^[ \t]*\[\[PHOTO\]\][ \t]*\r?\n(?:[ \t]*\r?\n)?/m;

// The legal notice's optional lines: each blank stands alone on its line and
// becomes this paragraph where the content file has the value, or the line
// goes. A phone number shows as written in its tel: link.
const lineBlank = (key) => new RegExp(`^([ \\t]*)\\[\\[${key}\\]\\][ \\t]*\\r?\\n`, "m");
const phoneText = (tel) => {
  try {
    return decodeURIComponent(tel.slice("tel:".length));
  } catch {
    return tel.slice("tel:".length);
  }
};
export const LEGAL_NOTICE_LINES = {
  ADDRESS: (address) => `<p>Address: ${escapeHtml(address)}</p>`,
  PHONE: (tel) => `<p>Phone: <a href="${escapeHtml(tel)}">${escapeHtml(phoneText(tel))}</a></p>`,
  VAT: (vat) => `<p>VAT number: ${escapeHtml(vat)}</p>`,
};
const fillLine = (page, key, value) =>
  page.replace(lineBlank(key), (_, indent) => (value ? `${indent}${LEGAL_NOTICE_LINES[key](value)}\n` : ""));

// The template with its blanks filled in. A blank with nothing to fill it
// stays, so the Check can name it.
export const fillBlanks = (page, blanks) =>
  [["ADDRESS", blanks.address], ["PHONE", blanks.phone], ["VAT", blanks.vat]]
    .reduce((filled, [key, value]) => fillLine(filled, key, value), page.replace(PHOTO_BLANK, blanks.photo ? `${PHOTO_SECTION}\n\n` : ""))
    .replace(/\[\[([A-Z_]+)\]\]/g, (blank, key) => (blanks[key] ? escapeHtml(blanks[key]) : blank));

// Whether a legal page is the one written for the person in the content
// file: complete, and naming them. Such a page is theirs, translated or
// changed by hand, and a checkpoint keeps it. While the content file cannot
// be read, any complete page counts as theirs.
export const writtenFor = (page, { name, unreadable }) =>
  legalPageProblems(page).length === 0 && (unreadable || (Boolean(name) && (page.includes(name) || page.includes(escapeHtml(name)))));

// The legal page for this content, from the template: the page, and the
// blanks it was filled with.
export async function legalPage(content, { today, template = TEMPLATE_PATH } = {}) {
  const blanks = legalBlanks(content, today);
  return { page: fillBlanks(await readFile(template, "utf8"), blanks), blanks };
}

// Writes the legal page for this content into the site folder, as
// site/privacy.html, and says what it filled in.
export async function writeLegalPage(siteDir, content, options) {
  const { page, blanks } = await legalPage(content, options);
  const path = join(siteDir, "privacy.html");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, page);
  return { path, blanks };
}
