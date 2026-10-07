// Finds text in the content file and in the site's other text files that
// looks like a phone number or a postal address, and photos that still hold
// where they were taken. The repo is public, so these must never be in it. A
// heuristic: it reports what looks suspicious; the person decides.
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

// Digits with spaces, dots, dashes, slashes or brackets between them.
const PHONE_CANDIDATE = /(?:\+|\b00)?\d[\d\s().\/-]{5,}\d/g;

// House numbers have at most three digits, so "Corso di Laurea 2021" (a year)
// is not an address, while "Corso di Porta Romana 12" is.
const ADDRESS_PATTERNS = [
  // 12 Example Street, 3 Long Lane
  /\b\d{1,5}\s+(?:[A-Z][\p{L}'-]*\s+){1,3}(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Drive|Boulevard|Blvd\.?)(?=\W|$)/u,
  // Via Esempio 12, Rue de l'Exemple 4, Calle Ejemplo 7
  /\b(?:Via|Viale|Corso|Piazza|Piazzale|Vicolo|Largo|Rue|Calle|Avenida|Plaza|Rua)\s+(?:[\p{L}'.-]+\s+){1,4}\d{1,3}[a-z]?(?!\d)\b/u,
  // Beispielstraße 5, Musterweg 12a
  /[\p{L}-]+(?:straße|strasse|str\.|weg|gasse|allee|platz)\s+\d{1,3}[a-z]?(?!\d)\b/iu,
  // …, 20121 Milano (a postcode after a comma, as in a written address)
  /,\s*\d{5}\s+[A-Z][\p{L}]+/u,
  // SW1A 1AA
  /\b[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}\b/,
];

const digitCount = (text) => text.replace(/\D/g, "").length;

// Date ranges such as 2019-2024 or 01/2020 - 12/2023.
const DATE_RANGE = /^(?:\d{1,2}[./-])?(?:19|20)\d{2}\s*[-–]\s*(?:\d{1,2}[./-])?(?:19|20)\d{2}$/;

// A date written as 2026-10-04, maybe with a time after it.
const ISO_DATE = /^(?:19|20)\d{2}-\d{2}-\d{2}\b/;

function looksLikePhone(candidate, textBefore) {
  if (/ISBN[\s:-]*$/i.test(textBefore)) return false;
  if (ISO_DATE.test(candidate.trim())) return false;
  const international = /^(\+|00)/.test(candidate);
  if (!international && DATE_RANGE.test(candidate.trim())) return false;
  return digitCount(candidate) >= (international ? 8 : 9);
}

// Web links are checked only where they carry a phone number by design.
const isPlainWebLink = (text) =>
  /^https?:\/\//.test(text) && !/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(text);

// A link that dials a phone number, however short: tel:+00 000 000 0000, tel:000.
const PHONE_LINK = /\btel:(?:\+?[\d\s().\/-]*\d|[^\s"'<>]*)/gi;

// Where a person lives is a city, never more: words that name a street, in
// the languages of the workshop, and the digits of a house number or postcode.
// "St. Gallen" or "Largo" alone are cities, so the street word needs a name.
const STREET_WORD =
  /(?<!\p{L})(?:Via|Viale|Corso|Piazza|Piazzale|Vicolo|Largo|Rue|Calle|Avenida|Rua)\s+\p{L}|\p{L}\s+(?:Street|Road|Avenue|Lane|Drive|Boulevard)(?!\p{L})|\p{L}(?:straße|strasse|gasse|allee|weg|platz)(?!\p{L})/iu;

function findInPlace(text) {
  if (/\d/.test(text)) return [`"${text}" looks like a postcode or a house number: give the city only.`];
  if (STREET_WORD.test(text)) return [`"${text}" looks like a street: give the city only.`];
  return [];
}

// Fields that hold a place: the city of the location or of an event, and its country.
const isPlace = (path) => ["city", "country"].includes(path.at(-1)) && (path[0] === "location" || path[0] === "events");

function* textValues(value, path = []) {
  if (typeof value === "string") yield { path, text: value };
  else if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) yield* textValues(entry, [...path, index + 1]);
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) yield* textValues(entry, [...path, key]);
  }
}

// What in one piece of text looks like a phone number or a postal address.
function findInText(fullText) {
  const found = [];
  // A phone link is named once, as a link, not again as a number.
  for (const [link] of fullText.matchAll(PHONE_LINK)) found.push(`"${link.trim()}" is a phone link.`);
  const text = fullText.replace(PHONE_LINK, (link) => " ".repeat(link.length));
  for (const match of text.matchAll(PHONE_CANDIDATE)) {
    const candidate = match[0];
    if (looksLikePhone(candidate, text.slice(0, match.index))) {
      found.push(`"${candidate.trim()}" looks like a phone number.`);
    }
  }
  // One address finding per text: street and postcode are the same address.
  const address = ADDRESS_PATTERNS.map((pattern) => text.match(pattern)).find(Boolean);
  if (address) found.push(`"${address[0]}" looks like a postal address.`);
  return found;
}

export function findPrivateDataInContent(content) {
  const findings = [];
  for (const { path, text } of textValues(content)) {
    if (isPlainWebLink(text)) continue;
    const where = ["content.json", ...path].join(" > ");
    const found = findInText(text);
    for (const finding of found.length === 0 && isPlace(path) ? findInPlace(text) : found) findings.push(`${where}: ${finding}`);
  }
  return findings;
}

// Files a person or an agent writes text into. Code (CSS, JavaScript), fonts,
// images and SVG drawings are left out: their long runs of digits are
// numbers, not phone numbers, and the content lives in content.json and HTML.
const TEXT_FILES = new Set([".html", ".htm", ".json", ".md", ".txt", ".xml", ".webmanifest"]);

// Inline drawings, scripts and styles in an HTML page, blanked out so the line
// numbers of everything else stay the same.
const CODE_IN_HTML = /<(svg|script|style)\b[\s\S]*?<\/\1>/gi;
const blankOut = (text) => text.replace(CODE_IN_HTML, (code) => code.replace(/[^\n]/g, " "));

// Web links, except the ones that carry a phone number by design.
const WEB_LINK = /https?:\/\/(?!wa\.me\/|api\.whatsapp\.com\/)[^\s"'<>)]+/g;

// Photos as a phone or camera saves them, which may hold where they were taken.
const PICTURES = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif", ".tif", ".tiff"]);

// Whether the EXIF data at this point, a TIFF structure, holds a GPS
// position: a GPS directory with a latitude or a longitude in it.
function exifHasPosition(bytes, start) {
  const order = bytes.toString("latin1", start, start + 2);
  if (order !== "II" && order !== "MM") return false;
  const u16 = (at) => (order === "II" ? bytes.readUInt16LE(start + at) : bytes.readUInt16BE(start + at));
  const u32 = (at) => (order === "II" ? bytes.readUInt32LE(start + at) : bytes.readUInt32BE(start + at));
  const tags = (directory) =>
    Array.from({ length: u16(directory) }, (_, index) => ({ tag: u16(directory + 2 + index * 12), value: u32(directory + 10 + index * 12) }));
  try {
    if (u16(2) !== 42) return false;
    const gps = tags(u32(4)).find(({ tag }) => tag === 0x8825);
    return Boolean(gps) && tags(gps.value).some(({ tag }) => tag === 2 || tag === 4);
  } catch {
    return false; // Not a whole TIFF structure: no position in it.
  }
}

// Where EXIF data may start: after "Exif\0\0" (JPEG, HEIC, AVIF), in a PNG's
// eXIf chunk, or in a WebP's EXIF chunk.
function exifStarts(bytes) {
  const starts = [];
  const each = (marker, skip) => {
    for (let at = bytes.indexOf(marker); at >= 0; at = bytes.indexOf(marker, at + 1)) starts.push(at + skip);
  };
  each("Exif\0\0", 6);
  each("eXIf", 4);
  each("EXIF", 8);
  return starts;
}

// Whether a picture holds where it was taken, in its EXIF or its XMP data.
export const holdsPosition = (bytes) =>
  bytes.includes("GPSLatitude") || bytes.includes("GPSLongitude") || exifStarts(bytes).some((start) => exifHasPosition(bytes, start));

// The same search in every text file of the site but content.json, line by
// line; and in every photo, for the place where it was taken.
export async function findPrivateDataInSiteFiles(siteDir) {
  const findings = [];
  const entries = await readdir(siteDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const where = relative(siteDir, path).replaceAll("\\", "/");
    if (PICTURES.has(extname(entry.name).toLowerCase())) {
      if (holdsPosition(await readFile(path))) {
        findings.push(`${where}: this photo holds where it was taken, as GPS data. Make a copy without it with node tools/photo.mjs, and delete this file.`);
      }
      continue;
    }
    if (!TEXT_FILES.has(extname(entry.name).toLowerCase()) || where === "content.json") continue;
    const text = await readFile(path, "utf8");
    const lines = (/\.html?$/i.test(path) ? blankOut(text) : text).split("\n");
    for (const [index, line] of lines.entries()) {
      for (const finding of findInText(line.replace(WEB_LINK, " "))) {
        findings.push(`${where}, line ${index + 1}: ${finding}`);
      }
    }
  }
  return findings.sort();
}
