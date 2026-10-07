// What a fixture site's files contain: its colour tokens, and anything it
// would load from another server.
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

// The colour tokens a stylesheet defines with light-dark(), e.g. { accent: { Light: "#1a56db", Dark: "#8fb2ff" } }.
export function lightDarkTokens(css) {
  const tokens = {};
  const definition = /--([\w-]+)\s*:\s*light-dark\(\s*(#[0-9a-f]{3,6})\s*,\s*(#[0-9a-f]{3,6})\s*\)/gi;
  for (const [, name, light, dark] of css.matchAll(definition)) {
    tokens[name] = { Light: light.toLowerCase(), Dark: dark.toLowerCase() };
  }
  return tokens;
}

// Every place a site's HTML, CSS or JavaScript would load something from another server.
const LOADS_FROM_ELSEWHERE = [
  /<(?:script|img|source|iframe|video|audio)\b[^>]*\b(?:href|src)\s*=\s*["']?(?:https?:)?\/\//i,
  // A <link> loads what it points to, such as a stylesheet, an icon or a font,
  // unless it only names an address, as the canonical link does.
  /<link\b(?![^>]*\brel\s*=\s*(["']?)(?:canonical|me|author)\1[\s/>])[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\//i,
  /\bsrcset\s*=\s*["'][^"']*(?:https?:)?\/\//i,
  /url\(\s*["']?(?:https?:)?\/\//i,
  /@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i,
  /\b(?:import|fetch)\s*\(\s*["'`](?:https?:)?\/\//i,
  /\bfrom\s+["'](?:https?:)?\/\//i,
];

export async function loadsFromElsewhere(siteDir) {
  const found = [];
  for (const entry of await readdir(siteDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || ![".html", ".css", ".js", ".mjs"].includes(extname(entry.name))) continue;
    const path = join(entry.parentPath, entry.name);
    const text = await readFile(path, "utf8");
    for (const pattern of LOADS_FROM_ELSEWHERE) {
      const match = text.match(pattern);
      if (match) found.push(`${path}: ${match[0]}`);
    }
  }
  return found;
}

