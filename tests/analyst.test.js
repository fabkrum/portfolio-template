import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pageLabels } from "../site/assets/render.js";
import { runCheck } from "../tools/check/run-check.mjs";
import { validateContent } from "../tools/check/schema.mjs";
import { buildFixtureSite } from "./fixture-site.js";
import { italianLabels } from "./italian-labels.js";
import { agentText, answerCount, turnsIn } from "./proxy-report.js";

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

test("the command lists a schema mistake, and still exits 0", async () => {
  const { stdout, status } = await runOn({
    ...sample,
    headline: "",
    bio: [...sample.bio, "Call me on +00 000 000 0000."],
  });
  assert.equal(status, 0);
  assert.match(stdout, /1 thing to fix/);
  assert.match(stdout, /headline must not be empty/);
  assert.doesNotMatch(stdout, /phone/);
});

// What the site shows is the person's choice.
test("a phone link and the legal notice's address and VAT number are ready as they are", async () => {
  const { stdout } = await runOn({
    ...sample,
    links: [...sample.links, { label: "Phone", url: "tel:+390000000000" }],
    legal: { address: "Via Esempio 1, 20100 Milano, Italy", vatId: "IT00000000000" },
  });
  assert.match(stdout, /site\/content\.json is ready|is ready: it matches the schema/);
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

test("the Analyst puts a phone number on the site only when the person wants calls, as a tel: link", async () => {
  const skill = await analystSkill();
  assert.match(skill, /What the site shows is the person's choice/);
  assert.match(skill, /phone number goes on it when they want calls/);
  assert.match(skill, /`tel:`/);
  assert.doesNotMatch(skill, /No phone number and no postal address, ever|Never a `tel:` link|do not type your phone number/);
});

// The legal notice is written later, by node tools/legal.mjs, from what the
// Analyst puts into legal: the links question asks for it.
test("the Analyst asks for the legal notice's address and VAT number in the links question, and writes them into legal", async () => {
  const skill = await analystSkill();
  const interview = skill.split(/^## /m).find((section) => section.startsWith("3"));
  const links = interview.match(/^\d+\. \*\*Links\*\*: (.*)$/m)?.[1] ?? "";
  assert.match(links, /If your site offers services, for example to freelance clients, the law asks for a postal address in the legal notice, and in Italy for your Partita IVA: give them, or say no\./);
  for (const needed of ["`legal.address`", "`vatId`", "`node tools/legal.mjs`", "end of the Developer step"]) assert.ok(skill.includes(needed), needed);
  assert.doesNotMatch(skill, /Lawyer/);
});

// The JSON blocks of a skill, as text, and the spec template the Analyst fills in.
const jsonBlocks = (skill) => [...skill.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => match[1]);
const specTemplate = (skill) => skill.match(/```markdown\n([\s\S]*?)```/)[1];

test("the content file the Analyst skill shows matches the schema, the fields of the first screen too", async () => {
  const shape = JSON.parse(jsonBlocks(await analystSkill()).find((block) => block.includes('"$schema"')));
  const schema = JSON.parse(await read("../site/content.schema.json"));
  assert.deepEqual(validateContent(schema, shape), []);
  for (const field of ["pitch", "highlights", "availability", "location", "languages"]) assert.ok(field in shape, field);
  assert.deepEqual(Object.keys(shape.legal), ["address", "vatId"]);
});

test("the Analyst asks the site's goal and writes it into the spec", async () => {
  const skill = await analystSkill();
  const interview = skill.split(/^## /m).find((section) => section.startsWith("3"));
  const goal = interview.match(/^\d+\. \*\*Goal\*\*: (.*)$/m)?.[1] ?? "";
  for (const kind of [/job/, /freelance clients/, /speaking invitations/, /community/]) assert.match(goal, kind);
  assert.match(specTemplate(skill), /^## Goal$/m);
});

test("with the Install script's workshop.json, the Analyst adds the colophon's event and the workshop without asking; without it, neither", async () => {
  const skill = await analystSkill();
  for (const needed of [/without asking/, /Without `workshop\.json`, leave `builtAt` and the workshop out/]) assert.match(skill, needed);
  // The file as the skill shows it, and what the Analyst adds for it.
  const workshop = JSON.parse(jsonBlocks(skill).find((block) => block.startsWith('{ "event"')));
  const added = JSON.parse(`{${jsonBlocks(skill).find((block) => block.includes('"builtAt"'))}}`);
  const schema = JSON.parse(await read("../site/content.schema.json"));
  assert.deepEqual(validateContent(schema, { ...sample, ...added }), []);
  assert.deepEqual(added.builtAt, { event: workshop.event, date: workshop.date });
  // The workshop is one event, the person as an attendee, with the workshop as its one session.
  assert.deepEqual(added.events, [
    { name: workshop.event, date: workshop.date, city: workshop.city, role: "attendee", sessions: [{ type: "workshop", title: "AI-Native Web Development, Hands-On" }] },
  ]);
  assert.match(skill, /Never list the workshop under `certifications`: it is an event/);
});

// The event comes from the guide's install command, so a new workshop needs
// no change to the skill.
test("the Analyst names workshop.json and holds no fixed workshop date", async () => {
  const skill = await analystSkill();
  assert.match(skill, /`workshop\.json`/);
  for (const fixed of [/2026-10-(10|24)/, /\b(10|24) October\b/, /\bOctober (10|24)\b/, /DevFest (Milano|Venezia)/, /today's date/, /new Date\(/]) {
    assert.doesNotMatch(skill, fixed);
  }
});

test("the Analyst takes certifications and events from LinkedIn's sections, without a question of their own", async () => {
  const skill = await analystSkill();
  for (const needed of ["Licenses & certifications", "Volunteering", '"kind": "exam"', '"issued": "2025-03"', "There is no question about skills, highlights, certifications or events"]) {
    assert.ok(skill.includes(needed), needed);
  }
});

// The guide's photo step: + → Media in the chat box. Copying the photo into
// the repo folder is the way when the agent cannot open the attachment.
test("the Analyst takes a photo attached with + → Media, runs the photo tool, and puts the photo on the page", async () => {
  const skill = await analystSkill();
  const offer = skill.match(/^"Would you like a photo of yourself on your site\? (.*)"$/m)?.[1] ?? "";
  assert.match(offer, /Click the \*\*\+\*\* in the chat box, then \*\*Media\*\*, pick your photo/);
  assert.match(offer, /not one made by AI/);
  for (const needed of [
    "When the person attaches a photo, copy the attached file into the repo folder",
    "Never into `site/`",
    "Copy the photo into your repo folder",
    "node tools/photo.mjs",
    '"src": "assets/photo.webp"',
    '"alt"',
    "delete the original photo",
    "If you copied it into the repo folder, delete it yourself",
    '"Your photo is on your site: open the preview, or reload it, to see it."',
  ]) {
    assert.ok(skill.includes(needed), needed);
  }
});

// After a LinkedIn text or a CV, the person sees what goes on the page and
// can change or take out parts before anything is written.
test("the Analyst shows what it found in the text and waits for the person's answer, outside the 8 questions", async () => {
  const skill = await analystSkill();
  const sort = skill.split(/^## /m).find((section) => section.startsWith("2"));
  assert.match(sort, /Show what you found before you ask anything else/);
  assert.match(sort, /^"Is this right\? Tell me what to change or leave out, or say \*\*yes\*\*\."$/m);
  assert.match(sort, /nothing they took out goes into the content file/);
  assert.match(sort, /This message is not one of the 8 questions/);
  assert.match(skill, /The one exception is the message in step 2 that shows what you found in their text: it is not one of the 8\./);
  // It comes before the questions about the gaps, and the file is written after them.
  assert.ok(skill.indexOf("Show what you found") < skill.indexOf("## 3. Ask about the gaps"));
  assert.ok(skill.indexOf("## 3. Ask about the gaps") < skill.indexOf("## 4. Write the content file"));
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
  const turns = turnsIn(await read(`./fixtures/analyst-runs/${run}/report.md`), "Questions");
  assert.ok(turns, "report.md has no Questions section");
  return { answers: answerCount(turns), agentSaid: agentText(turns) };
}

// The Analyst's proxy runs, one per way to start.
const RUNS = ["linkedin", "cv", "interview"];

for (const run of RUNS) {
  test(`${run} run: the content file matches the schema`, async () => {
    assert.deepEqual(validateContent(schema, await runContent(run)), []);
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

  test(`${run} run: laid over the built sample site, every item of the Check passes but the legal page, which the Developer writes later`, async () => {
    const { siteDir, remove } = await buildFixtureSite(fixturesDir, `analyst-runs/${run}/site`);
    try {
      for (const item of await runCheck(siteDir)) assert.equal(item.pass, item.id !== "legal", `${item.id}: ${item.details}`);
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

// The Designer interviews the person first and writes their Stitch prompt,
// so the hand-off must not send them to Stitch on their own.
test("the Analyst hands over to the Designer in a fresh chat, without sending the person to Stitch first", async () => {
  const handOff = (await analystSkill()).match(/^"The Analyst is done\. (.*)"$/m)?.[1] ?? "";
  assert.match(handOff, /^Start a fresh chat and ask for the Designer: it asks you a few questions about your style/);
  assert.doesNotMatch(handOff, /Stitch design|open Stitch|go to Stitch/i);
});

// A widget added later is in the site's language at once: the Analyst's
// labels already hold all the page's own words.
test("the Analyst's labels hold every word the page writes", async () => {
  const block = (await analystSkill()).match(/"labels": \{([\s\S]*?)\}/)[1];
  const names = [...block.matchAll(/"(\w+)":/g)].map((match) => match[1]);
  const modules = ["videos", "podcasts", "posts", "resources", "ideas"];
  assert.deepEqual(names.sort(), Object.keys(pageLabels({})).filter((name) => !modules.includes(name)).sort());
});
