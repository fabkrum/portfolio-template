// The Check: looks at a portfolio site folder and reports, item by item,
// what passes and what needs attention. It never blocks anything.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { findChrome, inspectSite } from "./browser.mjs";
import { findPrivateData } from "./private-data.mjs";
import { validateContent } from "./schema.mjs";

const item = (id, title, problems) => ({ id, title, pass: problems.length === 0, details: problems });

// Console errors and accessibility per page, or one reason for both items
// when the browser part could not run.
async function browserProblems(siteDir) {
  const chromePath = findChrome();
  if (!chromePath) {
    return "Google Chrome was not found, so this could not be checked. Install Chrome and run the Check again.";
  }
  const pagePaths = ["index.html", "privacy.html"].filter((page) => existsSync(join(siteDir, page)));
  try {
    const pages = await inspectSite(siteDir, pagePaths, chromePath);
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

async function browserItems(siteDir) {
  const found = await browserProblems(siteDir);
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

export async function runCheck(siteDir) {
  const { content, unreadable } = await readContent(siteDir);
  return [
    item("content", "Content file matches the schema", await schemaProblems(siteDir, content, unreadable)),
    ...(await browserItems(siteDir)),
    item(
      "privacy",
      "Privacy page present",
      existsSync(join(siteDir, "privacy.html"))
        ? []
        : ["There is no privacy.html in the site folder. The Lawyer role adds one."],
    ),
    item(
      "private-data",
      "No phone number or postal address in the content file",
      unreadable ? [`${unreadable} So this could not be checked.`] : findPrivateData(content),
    ),
  ];
}
