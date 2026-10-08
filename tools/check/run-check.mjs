// The Check: looks at a portfolio site folder and reports, item by item,
// what passes and what needs attention. It never blocks anything. It builds
// the site first, as publishing does, and looks at the built pages in
// Chrome; the files people and agents write, it reads in the site folder.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BuildError } from "../build/build-site.mjs";
import { decodeEntities } from "../build/html.mjs";
import { serveBuild } from "../build/serve-build.mjs";
import { agentViewProblems } from "./agent-view.mjs";
import { findChrome, inspectSite } from "./browser.mjs";
import { readContentFile } from "./content-file.mjs";
import { validateContent } from "./schema.mjs";

const item = (id, title, problems) => ({ id, title, pass: problems.length === 0, details: problems });

// Console errors and accessibility per page, or one reason for both items
// when the browser part could not run.
async function browserProblems(site) {
  const chromePath = findChrome();
  if (!chromePath) {
    return "Google Chrome was not found, so this could not be checked. Install Chrome and run the Check again.";
  }
  const pagePaths = ["index.html", "privacy.html"].filter((page) => site.build.pages.includes(page));
  try {
    const pages = await inspectSite(site.origin, pagePaths, chromePath);
    return {
      accessibility: pages.flatMap((page) =>
        page.violations.map((v) => `${page.path}: ${v.help} (${v.targets.join(", ")})`),
      ),
      console: pages.flatMap((page) => page.consoleErrors.map((error) => `${page.path}: ${error}`)),
    };
  } catch (error) {
    return `Chrome could not open the site, so this could not be checked: ${error.message}`;
  }
}

async function browserItems(site, notBuilt) {
  const found = notBuilt ?? (await browserProblems(site));
  const problems = typeof found === "string" ? { accessibility: [found], console: [found] } : found;
  return [
    item("accessibility", "Accessibility (the axe rules Lighthouse scores)", problems.accessibility),
    item("console", "No errors in the browser console", problems.console),
  ];
}

async function schemaProblems(siteDir, content, unreadable) {
  if (unreadable) return [unreadable];
  try {
    const schema = JSON.parse(await readFile(join(siteDir, "content.schema.json"), "utf8"));
    return validateContent(schema, content);
  } catch (error) {
    if (error.code === "ENOENT") return ["There is no content.schema.json in the site folder."];
    return [`The schema could not be used: ${error.message}`];
  }
}

// The legal page is privacy.html: a legal notice, a privacy notice and an
// accessibility statement, each a section with its id. The template ships it
// as a placeholder, marked data-placeholder and saying so; the Developer
// writes the real page with node tools/legal.mjs, from a template with
// [[BLANKS]]. No problems means the legal page is written.
export const isPlaceholderPage = (page) => /\bdata-placeholder\b/.test(page) || page.includes("This is a placeholder. The Developer replaces it");

const LEGAL_SECTIONS = [
  ["legal-notice", "legal notice"],
  ["privacy", "privacy notice"],
  ["accessibility", "accessibility statement"],
];

// The phone links of a page: what each calls and the number it shows. A
// number written with the trunk prefix in brackets, +49 (0)89 …, calls
// +4989 …: the (0) is not dialled.
const digits = (text) => text.replace(/\(0\)/g, "").replace(/\D/g, "");
const phoneLinks = (page) =>
  [...page.matchAll(/<a\b[^>]*\bhref=["']tel:([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(([, tel, text]) => ({
    tel: `tel:${decodeEntities(tel)}`,
    shown: decodeEntities(text.replace(/<[^>]*>/g, "")).trim(),
  }));

export function legalPageProblems(page) {
  if (isPlaceholderPage(page)) {
    return ["privacy.html is still the placeholder from the template. The Developer writes the legal page with node tools/legal.mjs: legal notice, privacy and accessibility."];
  }
  const blanks = [...new Set(page.match(/\[\[[A-Z_]+\]\]/g) ?? [])];
  return [
    ...(blanks.length > 0 ? [`privacy.html still has blanks to fill in: ${blanks.join(", ")}. node tools/legal.mjs fills them in from site/content.json.`] : []),
    ...LEGAL_SECTIONS.filter(([id]) => !new RegExp(`\\sid=["']${id}["']`).test(page)).map(
      ([id, name]) => `privacy.html has no ${name}: a section with id="${id}". node tools/legal.mjs writes the page again from its template.`,
    ),
    // A legal notice must be right: a phone link calls the number it shows.
    ...phoneLinks(page)
      .filter(({ tel, shown }) => digits(shown) !== "" && digits(tel) !== digits(shown))
      .map(({ tel, shown }) => `privacy.html shows the phone number ${shown}, but its link calls ${tel}. Both must be the number the person gave.`),
  ];
}

// The content file's phone link, a tel: address, if its links have one.
export const telLinkOf = (content) =>
  (Array.isArray(content?.links) ? content.links : []).map((link) => link?.url).find((url) => typeof url === "string" && url.trim() && url.startsWith("tel:"));

// The phone number in the content file's links and the one on the legal page
// must be the same number.
function phoneMismatchProblems(content, page) {
  const listed = telLinkOf(content);
  const onPage = phoneLinks(page)[0]?.tel;
  return listed && onPage && digits(listed) !== digits(onPage)
    ? [`The phone link in site/content.json calls ${listed}, but the one on the legal page calls ${onPage}. Both must be the number the person gave.`]
    : [];
}

// Every visitor must find the legal page: the home page's footer links to it.
const footerLinksLegalPage = (home) => /<footer\b[\s\S]*?\bhref=["']privacy\.html["'][\s\S]*?<\/footer>/i.test(home);

// Everything the item "Legal page written" checks, for the site in siteDir.
export async function legalProblems(siteDir, content) {
  const path = join(siteDir, "privacy.html");
  const page = existsSync(path) ? await readFile(path, "utf8") : null;
  const pageProblems = page === null
    ? ["There is no privacy.html in the site folder. node tools/legal.mjs writes the legal page."]
    : [...legalPageProblems(page), ...(isPlaceholderPage(page) ? [] : phoneMismatchProblems(content, page))];
  const homePath = join(siteDir, "index.html");
  const linked = !existsSync(homePath) || footerLinksLegalPage(await readFile(homePath, "utf8"));
  return [...pageProblems, ...(linked ? [] : ["The footer of index.html has no link to privacy.html, so visitors cannot find the legal page."])];
}

// The site built and served for the Check, or why it could not be: then the
// items that look at the built site say so, and the others still report.
async function builtSite(siteDir) {
  try {
    return { site: await serveBuild(siteDir) };
  } catch (error) {
    return {
      notBuilt:
        error instanceof BuildError
          ? `The site could not be built, so this could not be checked: ${error.message}`
          : `The Check could not build and open the site, so this could not be checked: ${error.message}`,
    };
  }
}

export async function runCheck(siteDir) {
  const { content, unreadable } = await readContentFile(siteDir);
  const { site, notBuilt } = await builtSite(siteDir);
  try {
    return [
      item("content", "Content file matches the schema", await schemaProblems(siteDir, content, unreadable)),
      ...(await browserItems(site, notBuilt)),
      item("agent", "What an agent sees: your content without JavaScript", notBuilt ? [notBuilt] : await agentViewProblems(site.outDir, content ?? {})),
      item("legal", "Legal page written", await legalProblems(siteDir, content)),
    ];
  } finally {
    await site?.close();
  }
}
