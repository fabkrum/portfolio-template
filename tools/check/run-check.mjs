// The Check: looks at a portfolio site folder and reports, item by item,
// what passes and what needs attention. It never blocks anything. It builds
// the site first, as publishing does, and looks at the built pages in
// Chrome; the files people and agents write, it reads in the site folder.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BuildError } from "../build/build-site.mjs";
import { serveBuild } from "../build/serve-build.mjs";
import { agentViewProblems } from "./agent-view.mjs";
import { findChrome, inspectSite } from "./browser.mjs";
import { findPrivateDataInContent, findPrivateDataInSiteFiles } from "./private-data.mjs";
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

// The parsed content file, or the reason it could not be read.
async function readContent(siteDir) {
  try {
    return { content: JSON.parse(await readFile(join(siteDir, "content.json"), "utf8")) };
  } catch (error) {
    const reason =
      error.code === "ENOENT"
        ? "There is no content.json in the site folder."
        : `content.json is not valid JSON: ${error.message}`;
    return { unreadable: reason };
  }
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

// The template ships privacy.html as a placeholder, marked data-placeholder
// and saying so; the Lawyer role writes the real page from a template with
// [[BLANKS]]. No problems means the Lawyer has written the page.
export const isPlaceholderPage = (page) => /\bdata-placeholder\b/.test(page) || page.includes("The Lawyer role replaces it");

export function privacyPageProblems(page) {
  if (isPlaceholderPage(page)) {
    return ["privacy.html is still the placeholder from the template. The Lawyer role writes the real page."];
  }
  const blanks = [...new Set(page.match(/\[\[[A-Z_]+\]\]/g) ?? [])];
  return blanks.length > 0
    ? [`privacy.html still has blanks to fill in: ${blanks.join(", ")}. The Lawyer role fills them in.`]
    : [];
}

async function privacyProblems(siteDir) {
  const path = join(siteDir, "privacy.html");
  if (!existsSync(path)) return ["There is no privacy.html in the site folder. The Lawyer role adds one."];
  return privacyPageProblems(await readFile(path, "utf8"));
}

// The site built and served for the Check, or why it could not be built.
async function builtSite(siteDir) {
  try {
    return { site: await serveBuild(siteDir) };
  } catch (error) {
    if (!(error instanceof BuildError)) throw error;
    return { notBuilt: `The site could not be built, so this could not be checked: ${error.message}` };
  }
}

export async function runCheck(siteDir) {
  const { content, unreadable } = await readContent(siteDir);
  const { site, notBuilt } = await builtSite(siteDir);
  try {
    return [
      item("content", "Content file matches the schema", await schemaProblems(siteDir, content, unreadable)),
      ...(await browserItems(site, notBuilt)),
      item("agent", "What an agent sees: your content without JavaScript", notBuilt ? [notBuilt] : await agentViewProblems(site.outDir, content)),
      item("privacy", "Privacy page written", await privacyProblems(siteDir)),
      // The files people and agents write: the built pages only repeat them.
      item("private-data", "No phone number or postal address in the site", [
        ...(unreadable ? [`${unreadable} So it could not be searched.`] : findPrivateDataInContent(content)),
        ...(await findPrivateDataInSiteFiles(siteDir)),
      ]),
    ];
  } finally {
    await site?.close();
  }
}
