// Just enough of HTML for the build to work on a page without a browser and
// without npm packages: it finds an element by its start tag, with where its
// content and its end tag are, changes attributes, and reads the text a
// reader sees.

// Elements that never have an end tag.
const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
// Elements whose content is text, not markup: a "<" in them starts no tag.
const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

// A comment, a doctype, or a start or end tag with its attributes.
const MARKUP = /<!--[\s\S]*?(?:-->|$)|<[!?][^>]*>?|<(\/?)([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ANY_TAG = /<\/?[a-zA-Z][^\s/>]*(?:[^>"']|"[^"]*"|'[^']*')*>/g;

export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", copy: "©",
};

export const decodeEntities = (text) =>
  text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (entity, decimal, hex, name) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
    const code = decimal ? Number(decimal) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });

function attributesOf(text) {
  const attributes = {};
  for (const [, name, double, single, bare] of text.matchAll(ATTRIBUTE)) {
    const key = name.toLowerCase();
    if (!(key in attributes)) attributes[key] = decodeEntities(double ?? single ?? bare ?? "");
  }
  return attributes;
}

// Every start and end tag of the page, in order, as { name, closing, start,
// end, attributes }: start and end are where the tag itself begins and ends.
export function tagsOf(html) {
  const tags = [];
  const markup = new RegExp(MARKUP.source, "g");
  for (let match = markup.exec(html); match; match = markup.exec(html)) {
    const [whole, slash, rawName, rest] = match;
    if (!rawName) continue;
    const tag = {
      name: rawName.toLowerCase(),
      closing: slash === "/",
      start: match.index,
      end: match.index + whole.length,
      attributes: slash ? {} : attributesOf(rest),
    };
    tags.push(tag);
    if (!tag.closing && RAW_TEXT_ELEMENTS.has(tag.name)) {
      const close = new RegExp(`</${tag.name}[\\s/>]`, "gi");
      close.lastIndex = tag.end;
      markup.lastIndex = close.exec(html)?.index ?? html.length;
    }
  }
  return tags;
}

// The first element whose start tag matches, as { tag, contentStart,
// contentEnd, end }, or null. contentEnd and end are null for an element
// with no end tag.
export function findElement(html, matches) {
  const tags = tagsOf(html);
  const index = tags.findIndex((tag) => !tag.closing && matches(tag));
  if (index < 0) return null;
  const tag = tags[index];
  const element = { tag, contentStart: tag.end, contentEnd: null, end: null };
  if (VOID_ELEMENTS.has(tag.name)) return element;
  let depth = 0;
  for (const other of tags.slice(index + 1)) {
    if (other.name !== tag.name) continue;
    if (!other.closing) depth++;
    else if (depth-- === 0) return { ...element, contentEnd: other.start, end: other.end };
  }
  return element;
}

// Every element of a kind with its content, such as each <script> with the
// script in it: { tag, content }.
export function elementsOf(html, matches) {
  const tags = tagsOf(html);
  const found = [];
  for (const [index, tag] of tags.entries()) {
    if (tag.closing || !matches(tag)) continue;
    const close = tags.slice(index + 1).find((other) => other.closing && other.name === tag.name);
    found.push({ tag, content: close ? html.slice(tag.end, close.start) : "" });
  }
  return found;
}

// A start tag with the attribute set to value, or with no value at all when
// value is true (as hidden), or taken out when value is null.
export function withAttribute(startTag, name, value) {
  const nameEnd = startTag.match(/^<[^\s/>]+/)[0].length;
  const found = [...startTag.slice(nameEnd).matchAll(ATTRIBUTE)].filter((match) => match[1].toLowerCase() === name);
  if (value === true && found.length === 1 && found[0][0].toLowerCase() === name) return startTag;
  let tag = startTag;
  for (const match of found.reverse()) {
    const start = nameEnd + match.index;
    tag = tag.slice(0, start).trimEnd() + tag.slice(start + match[0].length);
  }
  if (value === null) return tag;
  const attribute = value === true ? name : `${name}="${escapeHtml(value)}"`;
  return tag.replace(/\s*(\/?)>$/, ` ${attribute}$1>`);
}

// Where the page's <head> is, or null when it has none. Without its end
// tag, </head>, it ends where <body> starts.
export function headOf(html) {
  const head = findElement(html, (tag) => tag.name === "head");
  if (!head || head.contentEnd != null) return head;
  const body = findElement(html, (tag) => tag.name === "body");
  return body ? { ...head, contentEnd: body.tag.start, end: body.tag.start } : null;
}

// The first element in the <head> that matches, or null.
export const findInHead = (html, matches) => {
  const head = headOf(html);
  return head && findElement(html, (tag) => tag.start >= head.contentStart && tag.start < head.contentEnd && matches(tag));
};

// The page with the first element in its <head> that matches replaced, and
// whether there was one.
export function replaceInHead(html, matches, replacement) {
  const element = findInHead(html, matches);
  if (!element) return { html, found: false };
  return { html: html.slice(0, element.tag.start) + replacement + html.slice(element.end ?? element.tag.end), found: true };
}

// The page without the elements in its <head> that match, each taken out with
// its line when it has one of its own.
export function removeFromHead(html, matches) {
  let page = html;
  for (let element = findInHead(page, matches); element; element = findInHead(page, matches)) {
    page = cut(page, element.tag.start, element.end ?? element.tag.end);
  }
  return page;
}

// The text without start..end, and without the line it stood on when nothing
// else stood there.
function cut(text, start, end) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = text.indexOf("\n", end);
  const restOfLine = text.slice(end, lineEnd === -1 ? text.length : lineEnd);
  if (/^[ \t]*$/.test(text.slice(lineStart, start)) && /^[ \t\r]*$/.test(restOfLine)) {
    return text.slice(0, lineStart) + (lineEnd === -1 ? "" : text.slice(lineEnd + 1));
  }
  return text.slice(0, start) + text.slice(end);
}

// The page with the given markup put in front of the end tag that starts at
// "at", each piece on a line of its own, indented one step further than the
// end tag.
export function insertBefore(html, at, pieces) {
  const lineStart = html.lastIndexOf("\n", at - 1) + 1;
  const indent = html.slice(lineStart, at);
  if (!/^[ \t]*$/.test(indent)) return html.slice(0, at) + pieces.join("") + html.slice(at);
  const inner = `${indent}  `;
  const lines = pieces.map((piece) => `${inner}${piece.replaceAll("\n", `\n${inner}`)}\n`);
  return html.slice(0, lineStart) + lines.join("") + html.slice(lineStart);
}

// The text a reader sees in the page's <body>, as one line: no markup, and
// nothing of scripts, styles and templates.
export function visibleText(html) {
  const body = findElement(html, (tag) => tag.name === "body");
  let part = html;
  if (body?.contentEnd != null) part = html.slice(body.contentStart, body.contentEnd);
  else {
    const head = headOf(html);
    if (head) part = html.slice(0, head.tag.start) + html.slice(head.end);
  }
  const text = part
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(/<(script|style|template|textarea|title)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, " ")
    .replace(ANY_TAG, " ");
  return oneLine(decodeEntities(text));
}

// Text with every run of spaces and line breaks made one space.
export const oneLine = (text) => String(text).normalize("NFC").replace(/\s+/g, " ").trim();
