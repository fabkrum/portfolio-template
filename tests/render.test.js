import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderSections } from "../site/assets/render.js";

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
