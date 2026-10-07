// The build: turns the site folder into the finished site, the files GitHub
// Pages publishes. It puts the sections render.js makes from content.json into
// the pages, so the content is in each page itself: it shows without
// JavaScript, and search engines and AI agents read it. It writes the head of
// every page (title, description, canonical link, Open Graph and Twitter
// tags) and the structured data about the person into the home page, and puts
// robots.txt, sitemap.xml and llms.txt next to the pages. Every other file of
// the site folder is copied as it is. Only Node built-ins: no npm packages.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { validateContent } from "../check/schema.mjs";
import { decodeEntities, escapeHtml, findElement, findInHead, headOf, insertBefore, removeFromHead, replaceInHead, withAttribute } from "./html.mjs";
import { jsonLdScript, llmsTxt, photoUrl, profilePage } from "./profile.mjs";

// A problem with the site that the person can fix, in plain words.
export class BuildError extends Error {}

// A value from the content file, if it is text with something in it.
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

// Today as YYYY-MM-DD, the day render.js splits upcoming from past events
// on. In the person's own time zone when the content file names one, so the
// build on GitHub's servers, which run on UTC, goes by the person's day;
// otherwise in this computer's.
export function todayFor(content, now = new Date()) {
  const timeZone = text(content?.location?.timeZone);
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
      const part = (type) => parts.find((each) => each.type === type).value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    } catch {
      // Not a time zone: go by this computer's day.
    }
  }
  const pad = (number) => String(number).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function readContentFile(siteDir) {
  let source;
  try {
    source = await readFile(join(siteDir, "content.json"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") throw new BuildError("There is no content.json in the site folder. The Analyst role writes it.");
    throw error;
  }
  let content;
  try {
    // Windows editors may start the file with a byte order mark.
    content = JSON.parse(source.replace(/^﻿/, ""));
  } catch (error) {
    throw new BuildError(
      `content.json is not valid JSON: ${error.message}. Look for a missing comma between two entries, a comma after the last entry of a list, or a missing quote.`,
    );
  }
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new BuildError('content.json must hold one object in curly braces, such as { "name": "Ada Example", … }.');
  }
  return content;
}

// What in the content file does not match the schema. The build goes on
// anyway, as far as it can: the Check and node tools/check-content.mjs report
// the same.
async function schemaProblems(siteDir, content) {
  let schema;
  try {
    schema = JSON.parse(await readFile(join(siteDir, "content.schema.json"), "utf8"));
  } catch (error) {
    return error.code === "ENOENT" ? [] : [`content.schema.json could not be read: ${error.message}`];
  }
  try {
    return validateContent(schema, content).map((problem) => `content.json: ${problem}`);
  } catch (error) {
    return [`content.json could not be checked against the schema: ${error.message}`];
  }
}

const firstLine = (error) => String(error?.message ?? error).split("\n")[0];

// render.js, loaded fresh whenever it changed. It is an ES module that nothing
// marks as one (there is no package.json), which Node before 22.7 does not
// work out by itself; from a data: URL it always loads as a module. Only a
// render.js that imports files next to it needs its own address.
async function loadRenderer(siteDir) {
  const path = join(siteDir, "assets", "render.js");
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") throw new BuildError("assets/render.js is missing: the build needs it to turn content.json into the page.");
    throw error;
  }
  const importsFiles = /(?:\bfrom|\bimport)\s*\(?\s*["'`]\.{1,2}\//.test(source);
  const url = importsFiles
    ? `${pathToFileURL(path).href}?version=${createHash("sha256").update(source).digest("hex").slice(0, 16)}`
    : `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  let renderer;
  try {
    renderer = await import(url);
  } catch (error) {
    throw new BuildError(`assets/render.js has a mistake: ${firstLine(error)}`);
  }
  if (typeof renderer.renderSections !== "function") {
    throw new BuildError("assets/render.js has no function renderSections, which turns content.json into the page.");
  }
  return renderer;
}

// Each section's HTML by its name, such as { bio: "<h1>…", projects: "" }.
function renderSections(renderer, content, today, problems) {
  let sections;
  try {
    sections = renderer.renderSections(content, { today });
  } catch (error) {
    const why = problems.length > 0 ? ` That may be because ${problems[0]}` : "";
    throw new BuildError(`assets/render.js could not turn content.json into the page: ${firstLine(error)}.${why}`);
  }
  if (!sections || typeof sections !== "object") throw new BuildError("assets/render.js gave the build no sections to put into the page.");
  return Object.entries(sections).map(([id, html]) => [id, typeof html === "string" ? html : ""]);
}

// The page's own words, such as the headings, in the site's language.
function pageLabels(renderer, content) {
  try {
    const labels = renderer.pageLabels?.(content);
    return labels && typeof labels === "object" ? labels : {};
  } catch {
    return {};
  }
}

// Files the operating system leaves in folders; they are not part of the site.
const SYSTEM_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

// Every file of the site folder, as a path such as "assets/styles.css".
async function siteFiles(siteDir) {
  let entries;
  try {
    entries = await readdir(siteDir, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") throw new BuildError(`There is no site folder at ${siteDir}.`);
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && !SYSTEM_FILES.has(entry.name))
    .map((entry) => relative(siteDir, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();
}

// A page's address: index.html is the folder it is in.
const pageUrl = (address, file) => new URL(file.replace(/(^|\/)index\.html$/, "$1"), address).href;

// Puts each section's HTML into the element of the page whose id is the
// section's name, wherever that element is, and hides the element while its
// section is empty. Returns the page, the sections it found no element for,
// and what went wrong.
function fillSections(html, sections, file) {
  let page = html;
  const homeless = [];
  const problems = [];
  for (const [id, inner] of sections) {
    const element = findElement(page, (tag) => tag.attributes.id === id);
    if (!element) homeless.push([id, inner]);
    else if (element.contentEnd === null) {
      problems.push(`${file}: the element with the id "${id}" has no end tag, so its section could not go into it.`);
    } else {
      const startTag = withAttribute(page.slice(element.tag.start, element.tag.end), "hidden", inner === "" ? true : null);
      page = page.slice(0, element.tag.start) + startTag + inner + page.slice(element.contentEnd);
    }
  }
  return { page, homeless, problems };
}

// A section that has no element in the page goes at the end of <main>, such
// as an Optional module the Developer made no place for. An empty <section>
// with its id in index.html puts it there instead.
function appendSections(html, sections) {
  const shown = sections.filter(([, inner]) => inner !== "");
  if (shown.length === 0) return html;
  const markup = shown.map(([id, inner]) => `<section id="${escapeHtml(id)}" class="section">${inner}</section>`);
  const parent = findElement(html, (tag) => tag.name === "main") ?? findElement(html, (tag) => tag.name === "body");
  return parent?.contentEnd == null ? html + markup.join("\n") : insertBefore(html, parent.contentEnd, markup);
}

// The footer's link to the privacy page, in the site's language.
function labelPrivacyLink(html, label) {
  const footer = findElement(html, (tag) => tag.name === "footer");
  if (!text(label) || footer?.contentEnd == null) return html;
  const link = findElement(
    html,
    (tag) => tag.name === "a" && tag.attributes.href === "privacy.html" && tag.start > footer.tag.start && tag.start < footer.contentEnd,
  );
  return link?.contentEnd == null ? html : html.slice(0, link.contentStart) + escapeHtml(label) + html.slice(link.contentEnd);
}

const isTitle = (tag) => tag.name === "title";
const isDescription = (tag) => tag.name === "meta" && tag.attributes.name?.toLowerCase() === "description";
const isCanonical = (tag) => tag.name === "link" && /(^|\s)canonical(\s|$)/i.test(tag.attributes.rel ?? "");
const isSocial = (tag) => tag.name === "meta" && /^(og|twitter|profile):/i.test(tag.attributes.property ?? tag.attributes.name ?? "");
const isJsonLd = (tag) => tag.name === "script" && /^\s*application\/ld\+json\s*(;|$)/i.test(tag.attributes.type ?? "");

// The canonical link, and the Open Graph and Twitter tags link previews on
// LinkedIn, WhatsApp or Slack read. Those that need an absolute address are
// left out while the site's address is not known.
function socialTags({ type, title, description, url, image, imageAlt }) {
  return [
    url && `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${type}">`,
    title && `<meta property="og:title" content="${escapeHtml(title)}">`,
    description && `<meta property="og:description" content="${escapeHtml(description)}">`,
    url && `<meta property="og:url" content="${escapeHtml(url)}">`,
    image && `<meta property="og:image" content="${escapeHtml(image)}">`,
    image && imageAlt && `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">`,
    '<meta name="twitter:card" content="summary">',
  ].filter(Boolean);
}

// The <head> as the build writes it. The home page takes its title,
// description, language and structured data from the content file. Any other
// page keeps its own title, description and language, as the Lawyer wrote
// them for the privacy page. Tags the build writes replace any already there.
function writeHead(html, head, file) {
  if (!headOf(html)) return { page: html, problems: [`${file} has no <head>, so it got no title, description or link preview tags.`] };
  let page = html;
  const added = [];
  if (head.home) {
    const title = replaceInHead(page, isTitle, `<title>${escapeHtml(head.title)}</title>`);
    page = title.html;
    if (!title.found) added.push(`<title>${escapeHtml(head.title)}</title>`);
    if (head.description) {
      const tag = `<meta name="description" content="${escapeHtml(head.description)}">`;
      const description = replaceInHead(page, isDescription, tag);
      page = description.html;
      if (!description.found) added.push(tag);
    }
  }
  page = removeFromHead(page, (tag) => isCanonical(tag) || isSocial(tag) || (head.home && isJsonLd(tag)));
  added.push(...socialTags(head));
  if (head.jsonLd) added.push(jsonLdScript(head.jsonLd));
  page = insertBefore(page, headOf(page).contentEnd, added);
  const root = findElement(page, (tag) => tag.name === "html");
  if (root && (head.home || !root.tag.attributes.lang)) {
    page = page.slice(0, root.tag.start) + withAttribute(page.slice(root.tag.start, root.tag.end), "lang", head.lang) + page.slice(root.tag.end);
  }
  return { page, problems: [] };
}

// A page's own title and description, as written in its <head>.
function ownHead(html) {
  const title = findInHead(html, isTitle);
  const description = findInHead(html, isDescription);
  return {
    title: title?.contentEnd != null ? text(decodeEntities(html.slice(title.contentStart, title.contentEnd))) : undefined,
    description: text(description?.tag.attributes.content),
  };
}

// Every search engine and AI crawler may read every page. Crawlers look for
// robots.txt at the root of a domain only, so on a site in a folder, such as
// username.github.io/portfolio/, it counts once the site has a domain of its
// own; the sitemap's address can also be given to a search engine directly.
const robotsTxt = (address) =>
  [
    "# Every search engine and AI crawler is welcome to read this whole site.",
    "User-agent: *",
    "Allow: /",
    ...(address ? ["", `Sitemap: ${new URL("sitemap.xml", address).href}`] : []),
    "",
  ].join("\n");

const sitemapXml = (urls) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");

// True when one folder is the other or holds it.
const within = (inner, outer) => {
  const path = relative(resolve(outer), resolve(inner));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};

// Writes the finished site into outDir, and removes what an earlier build
// left there that is no longer part of the site.
async function writeSite(siteDir, outDir, files, made) {
  const keep = new Set([...files, ...made.keys()]);
  for (const file of keep) {
    const target = join(outDir, ...file.split("/"));
    await mkdir(dirname(target), { recursive: true });
    if (made.has(file)) await writeFile(target, made.get(file));
    else await copyFile(join(siteDir, ...file.split("/")), target);
  }
  const folders = [];
  for (const entry of await readdir(outDir, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    if (entry.isDirectory()) folders.push(path);
    else if (!keep.has(relative(outDir, path).replaceAll("\\", "/"))) await rm(path, { force: true });
  }
  // Folders left empty, the deepest first.
  for (const folder of folders.sort((a, b) => b.length - a.length)) await rmdir(folder).catch(() => {});
}

// Builds the site in siteDir into outDir. address is where the site is
// published, such as https://ada-example.github.io/portfolio/, or null when
// it is not known; today is the day as YYYY-MM-DD; commit, the commit the
// site is built from, goes into version.txt. Throws a BuildError, before it
// writes anything, when the site cannot be built. Returns the address, the
// day, the pages and every file it wrote, and what needs attention.
export async function buildSite(siteDir, outDir, { address = null, today, commit = null } = {}) {
  if (within(outDir, siteDir) || within(siteDir, outDir)) {
    throw new Error(`The build writes into a folder of its own, never into the site folder or a folder around it: ${outDir}`);
  }
  const content = await readContentFile(siteDir);
  const warnings = await schemaProblems(siteDir, content);
  const renderer = await loadRenderer(siteDir);
  const day = today ?? todayFor(content);
  const sections = renderSections(renderer, content, day, warnings);
  const labels = pageLabels(renderer, content);
  const files = await siteFiles(siteDir);
  if (!files.includes("index.html")) throw new BuildError("There is no index.html in the site folder, so there is no page to build.");

  const name = text(content.name);
  const title = name ? `${name} · Portfolio` : "Portfolio";
  const image = photoUrl(content, address);
  const preview = { image: /\.svg$/i.test(image ?? "") ? undefined : image, imageAlt: text(content.photo?.alt) };
  const lang = text(content.language) ?? "en";
  const made = new Map();
  const pages = files.filter((file) => file.endsWith(".html"));
  for (const file of pages) {
    const home = file === "index.html";
    const source = await readFile(join(siteDir, ...file.split("/")), "utf8");
    const filled = fillSections(source, sections, file);
    let page = filled.page;
    if (home) page = labelPrivacyLink(appendSections(page, filled.homeless), labels.privacy);
    const own = ownHead(page);
    const head = home
      ? { home, type: "profile", title, description: text(content.pitch) ?? text(content.headline), lang, jsonLd: profilePage(content, { address, title }) }
      : { home, type: "website", title: own.title, description: own.description, lang };
    const written = writeHead(page, { ...head, ...preview, url: address ? pageUrl(address, file) : undefined }, file);
    made.set(file, written.page);
    warnings.push(...filled.problems, ...written.problems);
  }

  const has = (file) => files.includes(file);
  if (!has("robots.txt")) made.set("robots.txt", robotsTxt(address));
  if (address && !has("sitemap.xml")) {
    made.set("sitemap.xml", sitemapXml(["index.html", "privacy.html"].filter(has).map((file) => pageUrl(address, file))));
  }
  if (!has("llms.txt")) made.set("llms.txt", llmsTxt(content, labels, { address, title, privacy: has("privacy.html") }));
  if (commit) made.set("version.txt", `${commit}\n`);

  await writeSite(siteDir, outDir, files, made);
  return { address, today: day, pages, files: [...new Set([...files, ...made.keys()])].sort(), warnings };
}

// buildSite in a worker thread of its own, so that render.js, and every file
// it imports, loads fresh: the preview builds again and again in one process.
// Resolves to { warnings }, or to { problem } in plain words.
export function buildInWorker(siteDir, outDir, options = {}) {
  return new Promise((done) => {
    const worker = new Worker(new URL("./build-worker.mjs", import.meta.url), { workerData: { siteDir, outDir, options } });
    worker.once("message", done);
    worker.once("error", (error) => done({ problem: `The build itself ran into a problem: ${firstLine(error)}` }));
    worker.once("exit", () => done({ problem: "The build stopped before it was done." }));
  });
}
