import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome, launchChrome, navigate, openTab } from "../tools/check/chrome.mjs";
import { serveSite } from "../tools/check/serve-site.mjs";
import { sampleSite } from "./fixture-site.js";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const repoDir = fileURLToPath(new URL("..", import.meta.url));

// The command as the Analyst skill runs it, from the repo folder.
const runCommand = (...args) =>
  spawnSync(process.execPath, ["tools/check-content.mjs", ...args], { cwd: repoDir, encoding: "utf8" });

// Runs the command on a content file written to a temporary folder.
async function runOn(content) {
  const dir = await mkdtemp(join(tmpdir(), "content-"));
  try {
    const path = join(dir, "content.json");
    await writeFile(path, typeof content === "string" ? content : JSON.stringify(content, null, 2));
    return runCommand(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const sample = JSON.parse(await read("../site/content.json"));
// The page's own words for a site in Italian.
const italianLabels = { projects: "Progetti", links: "Dove trovarmi", cv: "Curriculum", experience: "Esperienza", education: "Formazione", skills: "Competenze", code: "Codice su GitHub", live: "Online", privacy: "Informativa sulla privacy" };

test("the command says the sample content file is ready", () => {
  const { stdout, status } = runCommand();
  assert.equal(status, 0);
  assert.match(stdout, /site\/content\.json is ready/);
});

test("the command lists a schema mistake and a phone number, and still exits 0", async () => {
  const { stdout, status } = await runOn({
    ...sample,
    headline: "",
    bio: [...sample.bio, "Call me on +00 000 000 0000."],
  });
  assert.equal(status, 0);
  assert.match(stdout, /2 things to fix/);
  assert.match(stdout, /headline must not be empty/);
  assert.match(stdout, /"\+00 000 000 0000" looks like a phone number/);
});

test("a postal address in the content file is named", async () => {
  const { stdout } = await runOn({ ...sample, bio: ["I live at 12 Example Street and love the web."] });
  assert.match(stdout, /"12 Example Street" looks like a postal address/);
});

test("the command says plainly when there is no content file", () => {
  const { stdout, status } = runCommand("site/no-such-content.json");
  assert.equal(status, 0);
  assert.match(stdout, /There is no content file at site\/no-such-content\.json/);
});

test("the command says plainly when the content file is not valid JSON", async () => {
  const { stdout } = await runOn('{ "name": "Ada Example", }');
  assert.match(stdout, /is not valid JSON/);
});

test("a content file with the page's words in Italian is ready", async () => {
  const { stdout } = await runOn({ ...sample, language: "it", labels: italianLabels });
  assert.match(stdout, /is ready/);
});

test("a label the page does not have is named", async () => {
  const { stdout } = await runOn({ ...sample, labels: { contact: "Contatti" } });
  assert.match(stdout, /"contact" is not allowed in labels/);
});

// What the page shows in Chrome when it is built from this content file: its
// language, headings, project links and the footer link.
async function pageWords(content) {
  const siteDir = await mkdtemp(join(tmpdir(), "page-words-"));
  await cp(sampleSite, siteDir, { recursive: true });
  await writeFile(join(siteDir, "content.json"), JSON.stringify(content));
  const server = await serveSite(siteDir);
  let chrome;
  try {
    chrome = await launchChrome(findChrome());
    const { sessionId } = await openTab(chrome.cdp);
    await navigate(chrome.cdp, sessionId, `${server.origin}/`);
    const expression = `({
      lang: document.documentElement.lang,
      headings: [...document.querySelectorAll("h2, h3")].map((h) => h.textContent.trim()),
      projectLinks: [...document.querySelectorAll(".project-links a")].map((a) => a.textContent.trim()),
      footer: document.querySelector("footer a[href='privacy.html']").textContent.trim(),
    })`;
    const { result } = await chrome.cdp.send("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
    return result.value;
  } finally {
    await chrome?.close();
    server.close();
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

const analystSkill = () => read("../.agents/skills/analyst/SKILL.md");

test("Antigravity finds the Analyst skill in the workspace skills folder", async () => {
  const frontmatter = (await analystSkill()).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  assert.match(frontmatter, /^name: analyst$/m);
  assert.match(frontmatter, /^description: .*Analyst.*LinkedIn.*CV.*$/m);
});

test("the Analyst writes the content file and the short spec, and checks the content file", async () => {
  const skill = await analystSkill();
  for (const needed of ["site/content.json", "site/content.schema.json", "docs/spec.md", "node tools/check-content.mjs", '"labels"']) {
    assert.ok(skill.includes(needed), needed);
  }
});

test("the Analyst asks at most 8 questions, one at a time, and agrees the site language", async () => {
  const skill = await analystSkill();
  assert.match(skill, /at most 8 questions/i);
  assert.match(skill, /one question at a time/i);
  assert.match(skill, /English/);
  assert.match(skill, /language/);
  // The interview is written out: no more than 8 numbered questions.
  const interview = skill.split(/^## /m).find((section) => section.startsWith("3"));
  const questions = interview.match(/^\d+\. \*\*/gm) ?? [];
  assert.ok(questions.length > 0 && questions.length <= 8, `${questions.length} questions`);
});

test("the Analyst keeps phone numbers and postal addresses out", async () => {
  const skill = await analystSkill();
  assert.match(skill, /phone number/);
  assert.match(skill, /postal address/);
});
