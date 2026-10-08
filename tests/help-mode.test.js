import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const skill = (name) => read(`../.agents/skills/${name}/SKILL.md`);
const frontmatter = (text) => text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
const descriptionOf = (text) => frontmatter(text).match(/^description: (.*)$/m)?.[1] ?? "";

// The commands in a skill: its fenced blocks with no language, such as json.
const commandsIn = (text) =>
  [...text.matchAll(/^ *```(\w*)\n([\s\S]*?)^ *```$/gm)].filter((match) => !match[1]).map((match) => match[2].trim());

// Each skill of the help mode, and what a person types to get it: the guide's
// own sentences ("Where am I?", "Explain site/index.html to me.", "Write down
// what we did and why.") and their close variants.
const SENTENCES = {
  help: ["Where am I?", "What's next?", "I'm stuck", "help", "error"],
  explain: ["Explain … to me", "Explain site/index.html to me", "Explain dark mode to me", "What does … do?", "Why …?"],
  recap: ["Write down what we did and why", "recap"],
};

for (const [name, sentences] of Object.entries(SENTENCES)) {
  test(`Antigravity finds the ${name} skill, and its description names what the person types for it`, async () => {
    const text = await skill(name);
    assert.match(frontmatter(text), new RegExp(`^name: ${name}$`, "m"));
    const description = descriptionOf(text);
    for (const sentence of sentences) assert.ok(description.includes(sentence), sentence);
    // A plain YAML value: a colon and a space inside it would cut it short.
    assert.doesNotMatch(description, /: /);
  });
}

test("help runs the one command that reads the repo, answers with the next step, and changes no file", async () => {
  const text = await skill("help");
  assert.deepEqual(commandsIn(text), ["node tools/where.mjs"]);
  for (const needed of [/change no file/, /do no Role's work/, /fresh chat/, /text block/, /Behind the room\?/, /If something goes wrong/, /smallest fix/]) {
    assert.match(text, needed);
  }
  // A checkpoint only on request, and then the checkpoint skill's way.
  assert.match(text, /Run a checkpoint only if the person asks you to catch them up; then follow the skill `checkpoint`/);
});

test("explain points to the real files and lines, ends with one question, and changes no file", async () => {
  const text = await skill("explain");
  assert.deepEqual(commandsIn(text), []);
  for (const needed of [/change none and run no command/, /file and lines/, /End with one question/, /Never make up a reason/]) assert.match(text, needed);
});

test("recap reads the spec, the brief, the git log and the privacy page, and writes only docs/recap.md", async () => {
  const text = await skill("recap");
  assert.deepEqual(commandsIn(text), ["node tools/where.mjs", "git --no-pager log --stat site design docs"]);
  for (const needed of ["docs/spec.md", "design/brief.md", "site/privacy.html", "exactly one file, `docs/recap.md`", "## What to learn next", "Read it back"]) {
    assert.ok(text.includes(needed), needed);
  }
  // One section per Role, each named where to find its decisions; the legal page is the Developer's.
  for (const role of ["Analyst", "Designer", "Developer", "QA", "Ops"]) assert.ok(text.includes(`- **${role}**:`), role);
  assert.match(text.split("- **Developer**:")[1].split("\n")[0], /site\/privacy\.html/);
  assert.doesNotMatch(text, /Lawyer/);
});

for (const name of Object.keys(SENTENCES)) {
  test(`${name}: every command is one line, never chained, so it runs in PowerShell too`, async () => {
    for (const command of commandsIn(await skill(name))) {
      assert.equal(command.split("\n").length, 1, command);
      assert.doesNotMatch(command, /&&|;|\\$/, command);
    }
  });
}

test("AGENTS.md names the three sentences and the skill for each, in a few lines", async () => {
  const rules = await read("../AGENTS.md");
  const section = rules.split(/^## /m).find((part) => part.includes("skill `help`"));
  assert.ok(section, "AGENTS.md does not name the skill help");
  for (const [sentence, name] of [["Where am I?", "help"], ["Explain … to me", "explain"], ["Write down what we did and why", "recap"]]) {
    const line = section.split("\n").find((each) => each.includes(`"${sentence}"`));
    assert.ok(line?.includes(`skill \`${name}\``), sentence);
  }
  // Thin: a heading and three lines.
  assert.ok(section.trim().split("\n").length <= 5, section);
});
