// Checks a design brief (design/brief.md) and returns what is missing or
// hard to read, in plain words. An empty list means the Developer role can
// build from it.

const SECTIONS = ["Colours", "Type", "Shapes", "Layout", "Components"];
export const TOKENS = ["background", "surface", "text", "muted", "accent", "on-accent"];
const TYPE_ROLES = ["headings", "body"];
const MODES = ["Light", "Dark"];
// Sections written as a list of points, which must not be left empty.
const PROSE_SECTIONS = ["Shapes", "Layout", "Components"];

// The body of every "## " section, by heading.
function sections(markdown) {
  const found = new Map();
  for (const part of markdown.split(/^## /m).slice(1)) {
    const [heading, ...body] = part.split("\n");
    found.set(heading.trim(), body.join("\n"));
  }
  return found;
}

// The rows of the first table in a section, keyed by their first cell,
// without the header row and the |---| line.
function tableRows(body) {
  const rows = new Map();
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim().startsWith("|"));
  if (start === -1) return rows;
  const end = lines.findIndex((line, index) => index > start && !line.trim().startsWith("|"));
  for (const line of lines.slice(start + 2, end === -1 ? undefined : end)) {
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    rows.set(cells[0], cells.slice(1));
  }
  return rows;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// The six colour tokens per mode, or the problems that stop us from reading them.
function readColours(body) {
  const rows = tableRows(body);
  const colours = Object.fromEntries(MODES.map((mode) => [mode, {}]));
  const problems = [];
  for (const token of TOKENS) {
    const row = rows.get(token);
    if (!row) {
      problems.push(`The colour table has no row for "${token}". Add it with a Light and a Dark hex value.`);
      continue;
    }
    MODES.forEach((mode, column) => {
      const value = row[column] ?? "";
      if (HEX.test(value)) colours[mode][token] = value;
      else problems.push(`"${token}" (${mode}) is "${value}", not a hex colour like #1a56db.`);
    });
  }
  return { colours, problems };
}

// Foreground on background, every pair the page actually shows.
const PAIRS = [
  ["text", "background"],
  ["muted", "background"],
  ["accent", "background"],
  ["text", "surface"],
  ["muted", "surface"],
  ["accent", "surface"],
  ["on-accent", "accent"],
];
// WCAG 2.2 AA for normal-size text.
const MINIMUM_CONTRAST = 4.5;

// Relative luminance and contrast ratio as WCAG 2.2 defines them.
function luminance(hex) {
  const digits = hex.length === 4 ? [...hex.slice(1)].map((digit) => digit + digit).join("") : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((start) => {
    const channel = parseInt(digits.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastProblems(colours) {
  const problems = [];
  for (const mode of MODES) {
    for (const [foreground, background] of PAIRS) {
      const [fg, bg] = [colours[mode][foreground], colours[mode][background]];
      if (!fg || !bg) continue;
      const ratio = contrast(fg, bg);
      if (ratio >= MINIMUM_CONTRAST) continue;
      // Never show a failing ratio rounded up to 4.50.
      const shown = Math.min(Number(ratio.toFixed(2)), 4.49).toFixed(2);
      problems.push(
        `"${foreground}" on "${background}" (${mode}) is hard to read: ${fg} on ${bg} has a contrast of ${shown}:1, it needs at least ${MINIMUM_CONTRAST}:1. Make one of the two lighter or darker.`,
      );
    }
  }
  return problems;
}

function typeProblems(body) {
  const rows = tableRows(body);
  return TYPE_ROLES.flatMap((role) => {
    if (!rows.has(role)) return [`The type table has no row for "${role}". Add it with a font, a size and a weight.`];
    return rows.get(role)[0] ? [] : [`The type table names no font for "${role}".`];
  });
}

export function checkBrief(markdown) {
  const found = sections(markdown);
  const problems = SECTIONS.filter((heading) => !found.has(heading)).map(
    (heading) => `The brief has no "${heading}" section. Add a line "## ${heading}" with its content below it.`,
  );
  if (found.has("Colours")) {
    const { colours, problems: unreadable } = readColours(found.get("Colours"));
    problems.push(...unreadable, ...contrastProblems(colours));
  }
  if (found.has("Type")) problems.push(...typeProblems(found.get("Type")));
  for (const heading of PROSE_SECTIONS) {
    if (found.has(heading) && !found.get(heading).trim()) {
      problems.push(`The "${heading}" section is empty. Describe the design's ${heading.toLowerCase()} in a few points.`);
    }
  }
  return problems;
}

// The brief's six colour tokens per mode, e.g. { Light: { accent: "#1a56db", … }, Dark: { … } }.
export function briefColours(markdown) {
  return readColours(sections(markdown).get("Colours") ?? "").colours;
}
