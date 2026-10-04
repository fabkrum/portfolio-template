import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "../tools/check/run-check.mjs";
import { findPrivateDataInContent } from "../tools/check/private-data.mjs";
import { validateContent } from "../tools/check/schema.mjs";
import { buildFixtureSite } from "./fixture-site.js";
import { italianLabels } from "./italian-labels.js";

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

// Proxy runs: a fresh agent on Claude Haiku 4.5 played the Analyst on fake
// LinkedIn text, a fake CV as a PDF, and an interview with nothing to start
// from, while the person's answers came from answers.md. Each run folder holds
// the input, what the agent told the person (report.md), the spec it wrote
// and, in site/, the content file it wrote. See fixtures/README.md.
const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const schema = JSON.parse(await read("../site/content.schema.json"));
const runContent = async (run) => JSON.parse(await read(`./fixtures/analyst-runs/${run}/site/content.json`));

// report.md has a section for the questions, up to the turn in which the
// content file was written, and one for reading it back. Every message of the
// person in the first section after the agent's first one answers a question.
async function questionsOf(run) {
  const report = await read(`./fixtures/analyst-runs/${run}/report.md`);
  const questions = report.split(/^## /m).find((section) => section.startsWith("Questions"));
  assert.ok(questions, "report.md has no Questions section");
  const turns = questions.split(/^\*\*(Agent|Person):\*\*/m).slice(1);
  const agentSaid = [];
  let answers = 0;
  for (let index = 0; index < turns.length; index += 2) {
    if (turns[index] === "Agent") agentSaid.push(turns[index + 1]);
    // The person's first message opens the chat; it answers nothing.
    else if (agentSaid.length > 0) answers += 1;
  }
  return { answers, agentSaid: agentSaid.join("\n") };
}

// What the person put in that must never reach the content file or the spec.
const planted = {
  linkedin: ["000 000 0000", "12 Example Street"],
  cv: ["000 000 0000", "Via Esempio", "00000", "1 January 2000"],
  interview: ["000 000 0000", "Placeholder Road"],
};

for (const run of Object.keys(planted)) {
  test(`${run} run: the content file matches the schema and has no phone number or postal address`, async () => {
    const content = await runContent(run);
    assert.deepEqual(validateContent(schema, content), []);
    assert.deepEqual(findPrivateDataInContent(content), []);
  });

  test(`${run} run: nothing private the person put in reached the content file or the spec`, async () => {
    const written = JSON.stringify(await runContent(run)) + (await read(`./fixtures/analyst-runs/${run}/spec.md`));
    for (const secret of planted[run]) assert.ok(!written.includes(secret), secret);
  });

  test(`${run} run: the short spec has every section`, async () => {
    const spec = await read(`./fixtures/analyst-runs/${run}/spec.md`);
    for (const heading of ["Who", "For whom", "What a visitor should do", "Language", "Sections", "Left out on purpose", "Later"]) {
      assert.ok(spec.includes(`## ${heading}`), heading);
    }
  });

  test(`${run} run: the spec says that who the site is for and what a visitor should do are guesses`, async () => {
    const sections = (await read(`./fixtures/analyst-runs/${run}/spec.md`)).split(/^## /m);
    for (const heading of ["For whom", "What a visitor should do"]) {
      assert.match(sections.find((section) => section.startsWith(heading)), /guess/i, heading);
    }
  });

  test(`${run} run: laid over the built sample site, every item of the Check passes but the Lawyer's privacy page`, async () => {
    const { siteDir, remove } = await buildFixtureSite(fixturesDir, `analyst-runs/${run}/site`);
    try {
      for (const item of await runCheck(siteDir)) assert.equal(item.pass, item.id !== "privacy", `${item.id}: ${item.details}`);
    } finally {
      await remove();
    }
  });
}

// A run that started from a text asked only what the text did not say, so
// fewer questions than the interview, and never for the name, the bio, the
// work or the education.
async function assertAskedOnlyGaps(run) {
  const { answers, agentSaid } = await questionsOf(run);
  assert.ok(answers < (await questionsOf("interview")).answers, `${answers} questions`);
  for (const known of [/what is your name/i, /tell me a little about yourself/i, /what work have you done/i, /which schools/i]) {
    assert.doesNotMatch(agentSaid, known);
  }
}

test("interview run: at most 8 questions, and the content comes from the answers alone", async () => {
  const { answers } = await questionsOf("interview");
  assert.ok(answers > 0 && answers <= 8, `${answers} questions`);
  const content = await runContent("interview");
  assert.equal(content.name, "Sam Placeholder");
  assert.equal(content.language ?? "en", "en");
  assert.deepEqual(content.projects.map((project) => project.github), ["https://github.com/octocat/Hello-World"]);
  assert.ok(content.links.some((link) => link.url === "mailto:sam@example.com"));
  // The recipe scaler has no GitHub link, so it cannot be a project.
  assert.ok(!content.projects.some((project) => /recipe/i.test(project.title)));
});

test("LinkedIn run: it asked only about the gaps, in fewer questions than the interview", async () => {
  await assertAskedOnlyGaps("linkedin");
  const content = await runContent("linkedin");
  assert.equal(content.name, "Luca Esempio");
  assert.equal(content.language ?? "en", "en");
  assert.deepEqual(content.projects.map((project) => project.github).sort(), ["https://github.com/octocat/Hello-World", "https://github.com/octocat/Spoon-Knife"]);
  assert.equal(content.cv.experience.length, 2);
});

test("CV run: it asked only about the gaps, and the site is in Italian, its headings too", async () => {
  await assertAskedOnlyGaps("cv");
  const content = await runContent("cv");
  assert.equal(content.name, "Giulia Placeholder");
  assert.equal(content.language, "it");
  assert.deepEqual(Object.keys(content.labels).sort(), ["code", "cv", "education", "experience", "links", "live", "privacy", "projects", "skills"]);
  assert.notEqual(content.labels.projects, "Projects");
  assert.ok(content.links.some((link) => link.url === "mailto:giulia@example.com"));
  assert.deepEqual(content.projects.map((project) => project.github), ["https://github.com/octocat/Hello-World"]);
});
