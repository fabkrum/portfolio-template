import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const deploySkill = () => read("../.agents/skills/deploy/SKILL.md");

// The commands in a skill: its fenced blocks with no language, such as json.
const commandsIn = (skill) =>
  [...skill.matchAll(/^ *```(\w*)\n([\s\S]*?)^ *```$/gm)].filter((match) => !match[1]).map((match) => match[2].trim());

test("Antigravity finds the Ops skill in the workspace skills folder", async () => {
  const frontmatter = (await deploySkill()).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  assert.match(frontmatter, /^name: deploy$/m);
  assert.match(frontmatter, /^description: .*Ops.*publish.*$/m);
});

test("Ops commits, pushes, and finds out with node tools/live.mjs whether the site is live", async () => {
  const commands = commandsIn(await deploySkill());
  for (const needed of ["git status", "git add -A", 'git commit -m "Publish my portfolio"', "git push", "node tools/live.mjs"]) {
    assert.ok(commands.includes(needed), needed);
  }
});

test("Ops explains the one-time Pages setting and publishes again once it is done", async () => {
  const skill = await deploySkill();
  assert.match(skill, /\*\*Source\*\* to \*\*GitHub Actions\*\*/);
  assert.ok(commandsIn(skill).includes('git commit --allow-empty -m "Publish again"'));
});

test("Ops keeps files the person did not make on purpose, such as a CV, out of the public repo", async () => {
  assert.match(await deploySkill(), /CV/);
});

for (const skillPath of ["../.agents/skills/deploy/SKILL.md", "../.agents/skills/portfolio-add-module/SKILL.md"]) {
  test(`${skillPath.split("/").at(-2)}: every command is one line, never chained, so it runs in PowerShell too`, async () => {
    for (const command of commandsIn(await read(skillPath))) {
      assert.equal(command.split("\n").length, 1, command);
      assert.doesNotMatch(command, /&&|;|\\$/, command);
    }
  });
}
