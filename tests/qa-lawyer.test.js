import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { TOKENS } from "../tools/brief/check-brief.mjs";
import { runCheck } from "../tools/check/run-check.mjs";
import { buildFixtureSite, sampleSite } from "./fixture-site.js";
import { assertWideLayout } from "./page-layout.js";
import { lightDarkTokens, loadsFromElsewhere } from "./site-files.js";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const frontmatter = (skill) => skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
const qaSkill = () => read("../.agents/skills/qa/SKILL.md");
const lawyerSkill = () => read("../.agents/skills/legal/SKILL.md");
const privacyTemplate = () => read("../.agents/skills/legal/privacy-template.html");

test("Antigravity finds the QA skill in the workspace skills folder", async () => {
  const meta = frontmatter(await qaSkill());
  assert.match(meta, /^name: qa$/m);
  assert.match(meta, /^description: .*QA.*$/m);
});

test("Antigravity finds the Lawyer skill in the workspace skills folder", async () => {
  const meta = frontmatter(await lawyerSkill());
  assert.match(meta, /^name: legal$/m);
  assert.match(meta, /^description: .*Lawyer.*$/m);
});

test("QA looks at the page before it trusts the Check, and looks again after fixing", async () => {
  const skill = await qaSkill();
  for (const needed of ["node tools/look.mjs", "node tools/check.mjs", "design/brief.md", "Largest Contentful Paint", "Cumulative Layout Shift"]) {
    assert.ok(skill.includes(needed), needed);
  }
  // Chrome DevTools for agents when Antigravity has it: Lighthouse and a performance trace.
  assert.match(skill, /lighthouse_audit/);
  assert.match(skill, /performance_start_trace/);
  // Antigravity asks before each of these tools runs: the person reads what it wants to do, then allows it.
  assert.match(skill, /Antigravity asks/);
  assert.match(skill, /Read what it wants to do/);
  assert.match(skill, /allow it/);
  // Looking comes first; the Check alone cannot see the layout.
  assert.ok(skill.indexOf("node tools/look.mjs") < skill.indexOf("node tools/check.mjs"));
  // It looks again after fixing: the look command is named more than once.
  assert.ok(skill.split("node tools/look.mjs").length > 2, "QA never looks again after fixing");
});

test("the Lawyer writes the privacy page from the template and searches for private data", async () => {
  const skill = await lawyerSkill();
  for (const needed of [".agents/skills/legal/privacy-template.html", "site/privacy.html", "site/content.json", "node tools/check.mjs", "phone number"]) {
    assert.ok(skill.includes(needed), needed);
  }
  // Every blank in the template is explained in the skill.
  const blanks = [...new Set((await privacyTemplate()).match(/\[\[[A-Z_]+\]\]/g))];
  assert.deepEqual(blanks.sort(), ["[[DATE]]", "[[EMAIL]]", "[[LANGUAGE]]", "[[NAME]]"]);
  for (const blank of blanks) assert.ok(skill.includes(blank), blank);
});

test("the privacy template covers what an EU portfolio without tracking must say", async () => {
  const page = await privacyTemplate();
  for (const needed of [
    "GDPR",
    "no cookies",
    "no analytics and no tracking",
    "GitHub Pages",
    "IP address",
    "Article 6(1)(f) GDPR",
    "EU-U.S. Data Privacy Framework",
    "Article 77 GDPR",
    'href="./"',
    'href="assets/styles.css"',
  ]) {
    assert.ok(page.includes(needed), needed);
  }
});

// Proxy runs: a fresh agent on Claude Haiku 4.5 played each role on a site
// with planted problems. "before" is the site it was given, "after" holds the
// files it changed. See fixtures/README.md.
const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const checkOf = async (name) => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, name);
  try {
    return Object.fromEntries((await runCheck(siteDir)).map((item) => [item.id, item]));
  } finally {
    await remove();
  }
};
const filesIn = async (name) =>
  (await readdir(join(fixturesDir, name), { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name !== "fixture.json")
    .map((entry) => relative(join(fixturesDir, name), join(entry.parentPath, entry.name)).replaceAll("\\", "/"));

test("QA was given a site with faint dates and the project heading in a column of its own", async () => {
  const items = await checkOf("qa-runs/before");
  assert.equal(items.accessibility.pass, false);
  assert.match(items.accessibility.details.join("\n"), /contrast.*\.period/);
  await assert.rejects(assertWideLayout(fixturesDir, "qa-runs/before"));
});

test("after QA, the site passes the Check's accessibility item and every other item but the Lawyer's", async () => {
  const items = await checkOf("qa-runs/after");
  for (const item of Object.values(items)) assert.equal(item.pass, item.id !== "privacy", `${item.id}: ${item.details}`);
});

test("after QA, the project cards sit side by side and the sections apart", async () => {
  await assertWideLayout(fixturesDir, "qa-runs/after");
});

test("QA changed only the site's code, kept the brief's six colours and loads nothing from elsewhere", async () => {
  const changed = await filesIn("qa-runs/after");
  assert.ok(changed.length > 0, "QA changed nothing");
  for (const file of changed) assert.ok(!["content.json", "privacy.html"].includes(file), file);
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "qa-runs/after");
  try {
    const before = lightDarkTokens(await readFile(join(fixturesDir, "built-sites/default-brief/assets/styles.css"), "utf8"));
    const after = lightDarkTokens(await readFile(join(siteDir, "assets", "styles.css"), "utf8"));
    for (const token of TOKENS) assert.deepEqual(after[token], before[token], `--${token}`);
    assert.deepEqual(await loadsFromElsewhere(siteDir), []);
  } finally {
    await remove();
  }
});

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("the Lawyer was given a content file with a phone number the Check flags and a birth date it cannot", async () => {
  const items = await checkOf("lawyer-runs/before");
  assert.equal(items["private-data"].pass, false);
  assert.match(items["private-data"].details.join("\n"), /\+00 000 000 0000.*phone number/);
  assert.doesNotMatch(items["private-data"].details.join("\n"), /born/);
  assert.equal(items.privacy.pass, false);
});

test("after the Lawyer, every item of the Check passes", async () => {
  for (const item of Object.values(await checkOf("lawyer-runs/after"))) {
    assert.equal(item.pass, true, `${item.id}: ${item.details}`);
  }
});

test("the Lawyer took out the phone number and the birth date, and nothing else", async () => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "lawyer-runs/after");
  try {
    const content = await readJson(join(siteDir, "content.json"));
    const sample = await readJson(join(sampleSite, "content.json"));
    const text = JSON.stringify(content);
    assert.doesNotMatch(text, /000 000 0000/);
    assert.doesNotMatch(text, /born|1 April 2000/i);
    for (const paragraph of sample.bio) assert.ok(content.bio.includes(paragraph), paragraph);
    assert.deepEqual({ ...content, bio: [] }, { ...sample, bio: [] });
  } finally {
    await remove();
  }
});

test("the Lawyer's privacy page names Ada Example, the email address and the date, and loads nothing from elsewhere", async () => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "lawyer-runs/after");
  try {
    const page = await readFile(join(siteDir, "privacy.html"), "utf8");
    for (const needed of ['lang="en"', "Ada Example", 'href="mailto:ada@example.com"', "4 October 2026", "GitHub Pages", "Article 77 GDPR", 'href="assets/styles.css"']) {
      assert.ok(page.includes(needed), needed);
    }
    assert.deepEqual(await loadsFromElsewhere(siteDir), []);
  } finally {
    await remove();
  }
});
