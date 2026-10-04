import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pageLabels, renderSections } from "../site/assets/render.js";
import { sampleSite } from "./fixture-site.js";
import { inChrome } from "./in-chrome.js";
import { italianLabels } from "./italian-labels.js";

const sample = JSON.parse(
  await readFile(new URL("../site/content.json", import.meta.url), "utf8"),
);

test("bio shows name, headline and every bio paragraph", () => {
  const { bio } = renderSections(sample);
  assert.ok(bio.includes(sample.name));
  assert.ok(bio.includes(sample.headline));
  for (const paragraph of sample.bio) assert.ok(bio.includes(paragraph));
});

test("every project is listed with a link to its GitHub repo", () => {
  const { projects } = renderSections(sample);
  for (const project of sample.projects) {
    assert.ok(projects.includes(project.title));
    assert.ok(projects.includes(`href="${project.github}"`));
  }
});

test("every social and contact link is rendered as a link", () => {
  const { links } = renderSections(sample);
  for (const link of sample.links) {
    assert.ok(links.includes(`href="${link.url}"`));
    assert.ok(links.includes(link.label));
  }
});

test("the CV lists experience, education and skills", () => {
  const { cv } = renderSections(sample);
  for (const job of sample.cv.experience) {
    assert.ok(cv.includes(job.role));
    assert.ok(cv.includes(job.organization));
  }
  for (const school of sample.cv.education) assert.ok(cv.includes(school.title));
  for (const skill of sample.cv.skills) assert.ok(cv.includes(skill));
});

test("a changed value in the content file changes the page", () => {
  const changed = { ...sample, name: "Someone Else Entirely" };
  assert.ok(renderSections(changed).bio.includes("Someone Else Entirely"));
});

test("content is escaped, never injected as markup", () => {
  const hostile = { ...sample, name: '<img src=x onerror="alert(1)">' };
  const { bio } = renderSections(hostile);
  assert.ok(!bio.includes("<img"));
  assert.ok(bio.includes("&lt;img"));
});

test("optional parts may be missing without breaking the page", () => {
  const minimal = { name: "Min", headline: "Dev", bio: ["Hi."], cv: {} };
  const sections = renderSections(minimal);
  assert.ok(sections.bio.includes("Min"));
  assert.equal(sections.projects, "");
  assert.equal(sections.links, "");
  assert.equal(sections.cv, "");
});

test("labels in the content file replace the page's English headings and link texts", () => {
  const withLive = { ...sample, projects: [{ ...sample.projects[1] }] };
  const sections = renderSections({ ...withLive, language: "it", labels: italianLabels });
  const page = Object.values(sections).join("");
  for (const label of ["Progetti", "Dove trovarmi", "Curriculum", "Esperienza", "Formazione", "Competenze", "Codice su GitHub", "Online"]) {
    assert.ok(page.includes(label), label);
  }
  for (const english of ["Projects", "Find me", ">CV<", "Experience", "Education", "Skills", "Code on GitHub", ">Live<"]) {
    assert.ok(!page.includes(english), english);
  }
});

test("a label left out stays in English", () => {
  const { projects } = renderSections({ ...sample, labels: { links: "Contatti" } });
  assert.ok(projects.includes("<h2>Projects</h2>"));
});

test("labels are escaped like every other value", () => {
  const { links } = renderSections({ ...sample, labels: { links: "<b>Find</b>" } });
  assert.ok(links.includes("&lt;b&gt;Find"));
});

// The Analyst translates the core sections' words; the Optional-module skill
// translates a module's heading when it adds the module.
test("the schema and the page name the same labels, and the skills translate every one", async () => {
  const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const page = Object.keys(pageLabels({})).sort();
  const schema = JSON.parse(await read("../site/content.schema.json"));
  assert.deepEqual(Object.keys(schema.properties.labels.properties).sort(), page);
  const labelNames = (block) => [...block.matchAll(/"(\w+)":/g)].map((match) => match[1]);
  const analyst = labelNames((await read("../.agents/skills/analyst/SKILL.md")).match(/"labels": \{([\s\S]*?)\}/)[1]);
  const modules = labelNames((await read("../.agents/skills/portfolio-add-module/SKILL.md")).match(/^\| Module \|[\s\S]*?\n\n/m)[0]);
  assert.deepEqual([...analyst, ...modules].sort(), page);
});

// What the page shows in Chrome when it is built from this content file: its
// language, headings, project links and the footer link.
async function pageWords(content) {
  const siteDir = await mkdtemp(join(tmpdir(), "page-words-"));
  try {
    await cp(sampleSite, siteDir, { recursive: true });
    await writeFile(join(siteDir, "content.json"), JSON.stringify(content));
    return await inChrome(siteDir, `({
      lang: document.documentElement.lang,
      headings: [...document.querySelectorAll("h2, h3")].map((h) => h.textContent.trim()),
      projectLinks: [...document.querySelectorAll(".project-links a")].map((a) => a.textContent.trim()),
      footer: document.querySelector("footer a[href='privacy.html']").textContent.trim(),
    })`);
  } finally {
    await rm(siteDir, { recursive: true, force: true });
  }
}

test("in Chrome, a content file in Italian turns the page's own words Italian, the footer link too", async () => {
  const words = await pageWords({ ...sample, language: "it", labels: italianLabels });
  assert.equal(words.lang, "it");
  assert.deepEqual(words.headings, ["Progetti", "Tide Tables", "Reading Log", "Dove trovarmi", "Curriculum", "Esperienza", "Formazione", "Competenze"]);
  assert.deepEqual(words.projectLinks, ["Codice su GitHub", "Codice su GitHub", "Online"]);
  assert.equal(words.footer, "Informativa sulla privacy");
});

test("in Chrome, the sample content file keeps the page in English", async () => {
  const words = await pageWords(sample);
  assert.equal(words.lang, "en");
  assert.equal(words.footer, "Privacy");
  assert.deepEqual(words.projectLinks, ["Code on GitHub", "Code on GitHub", "Live"]);
});

