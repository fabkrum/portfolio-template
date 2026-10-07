// Checks a design brief (design/brief.md) and returns what is missing or
// hard to read, in plain words. An empty list means the Developer role can
// build from it.

const SECTIONS = ["Colours", "Type", "Shapes", "Layout", "Components"];
export const TOKENS = ["background", "surface", "text", "muted", "accent", "on-accent"];
const TYPE_ROLES = ["headings", "body"];
// A third font for dates, labels and file names, which some styles have.
const OPTIONAL_TYPE_ROLES = ["details"];
const MODES = ["Light", "Dark"];
// Sections written as a list of points, which must not be left empty.
const PROSE_SECTIONS = ["Shapes", "Layout", "Components"];
// Sections the Designer's interview adds: the style, the one signature move
// and the order of the sections. Briefs written before them are still ready,
// so they are checked only when they are there.
const STYLE_SECTIONS = ["Style", "Signature", "Sections"];

export const STYLES = ["Classic", "Modern", "Bold", "Playful", "Technical"];

// The signature menu in .agents/skills/build/signatures.md: one Modern Web
// Guidance guide per move. A site gets exactly one of them.
export const SIGNATURE_GUIDES = [
  "guides/ui-behaviors/same-document-transitions.md",
  "guides/ui-behaviors/cross-document-transitions.md",
  "guides/ui-behaviors/scroll-entry-exit-effects.md",
  "guides/ui-atoms/scroll-progress-indicator.md",
  "guides/ui-atoms/shrinking-header-on-scroll.md",
  "guides/ui-components/scrollspy.md",
  "guides/ui-behaviors/dynamic-sibling-animations.md",
  "guides/css/child-state-based-styling.md",
  "guides/ui-behaviors/physics-based-easing.md",
  "guides/visual-design/complex-shapes.md",
  "guides/ui-behaviors/animate-element-entry-exit.md",
  "guides/visual-design/improve-text-layout-and-legibility.md",
];

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
  const missing = TYPE_ROLES.flatMap((role) =>
    rows.has(role) ? [] : [`The type table has no row for "${role}". Add it with a font, a size and a weight.`],
  );
  const unnamed = [...TYPE_ROLES, ...OPTIONAL_TYPE_ROLES]
    .filter((role) => rows.has(role) && !rows.get(role)[0])
    .map((role) => `The type table names no font for "${role}".`);
  return [...missing, ...unnamed];
}

// What a "- Name: …" line of a section says, or undefined.
const lineOf = (body, name) => body.match(new RegExp(`^\\s*[-*]?\\s*${name}\\s*:(.*)$`, "im"))?.[1].trim();

function styleProblems(body) {
  const style = lineOf(body, "Style");
  const named = [...new Set([...(style ?? "").matchAll(/\b(classic|modern|bold|playful|technical)\b/gi)].map(([word]) => word.toLowerCase()))];
  if (named.length === 0) {
    return [
      `The "Style" section has no line "- Style: …" that names one of the five styles: ${STYLES.join(", ")}. Name one, or two for a mix, such as "- Style: Playful, with a Technical touch: monospace dates".`,
    ];
  }
  if (named.length > 2) {
    return [`The "Style" section mixes ${named.length} styles. Mix at most two: the first one wins where they disagree.`];
  }
  return [];
}

function signatureProblems(body) {
  const guides = [...new Set(body.match(/guides\/[\w-]+\/[\w-]+\.md/g) ?? [])];
  const offMenu = guides.filter((guide) => !SIGNATURE_GUIDES.includes(guide));
  if (offMenu.length > 0) {
    return offMenu.map(
      (guide) => `"${guide}" in the "Signature" section is not a move on the signature menu. Choose one from .agents/skills/build/signatures.md and copy its guide.`,
    );
  }
  if (guides.length === 0) {
    return [`The "Signature" section names no guide. Write the move's guide from .agents/skills/build/signatures.md on a line "- Guide: …".`];
  }
  if (guides.length > 1) {
    return [`The "Signature" section names ${guides.length} moves. A site gets exactly one signature move: keep the one that fits the style best.`];
  }
  return [];
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
  for (const heading of STYLE_SECTIONS) {
    if (!found.has(heading)) continue;
    const body = found.get(heading);
    if (!body.trim()) {
      problems.push(`The "${heading}" section is empty. Fill it in as the Designer skill's template shows, or take the section out.`);
    } else if (heading === "Style") {
      problems.push(...styleProblems(body));
    } else if (heading === "Signature") {
      problems.push(...signatureProblems(body));
    }
  }
  return problems;
}

// The brief's six colour tokens per mode, e.g. { Light: { accent: "#1a56db", … }, Dark: { … } }.
export function briefColours(markdown) {
  return readColours(sections(markdown).get("Colours") ?? "").colours;
}

// The brief's font stacks, e.g. { headings: '"Inter", system-ui, sans-serif', body: … },
// with details as well when the Type table has that row.
export function briefFonts(markdown) {
  const rows = tableRows(sections(markdown).get("Type") ?? "");
  const roles = [...TYPE_ROLES, ...OPTIONAL_TYPE_ROLES.filter((role) => rows.has(role))];
  return Object.fromEntries(roles.map((role) => [role, rows.get(role)?.[0] ?? ""]));
}

// Fonts every computer has, and the generic families. Any other font first in
// a stack is a web font: it shows only once its files are in the site.
export const SYSTEM_FONTS = new Set([
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "sans-serif", "serif", "monospace",
  "cursive", "fantasy", "-apple-system", "blinkmacsystemfont", "segoe ui", "helvetica", "helvetica neue", "arial",
  "arial rounded mt bold", "verdana", "tahoma", "trebuchet ms", "georgia", "times new roman", "times",
  "courier new", "courier", "menlo", "monaco", "consolas",
]);

// The first font of a stack, the one the design asks for: '"Inter", system-ui' gives Inter.
export const firstFont = (stack) =>
  stack.trim().replace(/^`(.*)`$/, "$1").split(",")[0].trim().replace(/^["']|["']$/g, "");

// What is good to know about a brief that is ready: a web font the Developer
// cannot add in the workshop, because it is neither among the bundled fonts
// in fonts/ nor a font every computer has; and whether the brief leaves out
// the style, the signature move and the order of the sections. Notes never
// stop the Developer. bundled: the names of the fonts in fonts/.
export function briefNotes(markdown, { bundled = [] } = {}) {
  const found = sections(markdown);
  const notes = [];
  const isBundled = (font) => bundled.some((name) => name.toLowerCase() === font.toLowerCase());
  // The rows of the Type table per web font that is not bundled.
  const unbundled = new Map();
  for (const [role, stack] of Object.entries(briefFonts(markdown))) {
    const font = firstFont(stack);
    if (!font || SYSTEM_FONTS.has(font.toLowerCase()) || isBundled(font)) continue;
    unbundled.set(font, [...(unbundled.get(font) ?? []), role]);
  }
  for (const [font, roles] of unbundled) {
    notes.push(
      `The Type table names "${font}" for ${listed(roles, "and")}. It is not one of the fonts in the folder fonts/ and not a font every computer has, so the site cannot load it in the workshop: the page shows the next font of the stack. To use a font of your design, choose one that is bundled: ${listed(bundled, "or")}.`,
    );
  }
  const missing = STYLE_SECTIONS.filter((heading) => !found.has(heading));
  if (missing.length > 0) {
    notes.push(
      `The brief has no ${listed(missing.map((heading) => `"${heading}"`), "or")} section. The Developer builds without ${missing.length === 1 ? "it" : "them"}, from the colours, fonts and shapes alone.`,
    );
  }
  return notes;
}

// "a", "a and b", "a, b and c".
const listed = (items, word) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}`);
