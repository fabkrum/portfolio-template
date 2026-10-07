// What an agent sees: a search engine, an AI agent or a link preview reads the
// page as it is delivered and runs no JavaScript. Looks at the built site for
// what they need: the person's name, headline and every project title in the
// page itself, structured data (JSON-LD) that names the person, and robots.txt
// and sitemap.xml next to the pages.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { elementsOf, isJsonLdScript, oneLine, visibleText } from "../build/html.mjs";
import { filledText } from "./content-file.mjs";

// Every object in the structured data, however deep, that is a Person.
function* people(value) {
  if (Array.isArray(value)) {
    for (const each of value) yield* people(each);
  } else if (value && typeof value === "object") {
    const types = [value["@type"]].flat();
    if (types.includes("Person")) yield value;
    for (const each of Object.values(value)) yield* people(each);
  }
}

// Without a name in the content file, the build writes no structured data:
// there is no one to describe. The Check's content item names what is missing.
function structuredDataProblems(page, name) {
  if (!name) return [];
  const blocks = elementsOf(page, isJsonLdScript);
  if (blocks.length === 0) {
    return ["index.html has no structured data (JSON-LD) that says who you are. The build adds it into the page's <head>, so index.html needs one."];
  }
  const data = [];
  for (const { content } of blocks) {
    try {
      data.push(JSON.parse(content));
    } catch (error) {
      return [`The structured data (JSON-LD) in index.html is not valid JSON: ${error.message}`];
    }
  }
  if ([...people(data)].some((person) => oneLine(String(person.name ?? "")) === oneLine(name))) return [];
  return [`The structured data (JSON-LD) in index.html does not name you, "${name}", as a Person.`];
}

// What an agent misses in the built site in builtDir, in plain words; empty
// when it finds everything.
export async function agentViewProblems(builtDir, content) {
  let page;
  try {
    page = await readFile(join(builtDir, "index.html"), "utf8");
  } catch {
    return ["There is no index.html, so there is no page to read."];
  }
  const shown = visibleText(page);
  const missing = [
    ["your name", filledText(content.name)],
    ["your headline", filledText(content.headline)],
    ...(Array.isArray(content.projects) ? content.projects : []).map((project) => ["the project", filledText(project?.title)]),
  ]
    .filter(([, value]) => value && !shown.includes(oneLine(value)))
    .map(([what, value]) => `Without JavaScript, index.html does not show ${what} "${value}".`);
  if (missing.length > 0) {
    missing.push(
      "Search engines and AI agents read the page without running JavaScript. The build puts your content into the page from site/content.json; keep JavaScript for extras.",
    );
  }
  return [
    ...missing,
    ...structuredDataProblems(page, filledText(content.name)),
    ...["robots.txt", "sitemap.xml"].filter((file) => !existsSync(join(builtDir, file))).map((file) => `There is no ${file} next to the pages.`),
  ];
}
