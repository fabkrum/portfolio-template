import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
