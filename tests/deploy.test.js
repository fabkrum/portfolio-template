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

// Proxy run: a fresh agent on Claude Haiku 4.5 played Ops, with the person's
// side played turn by turn from answers.md. The repo pushed to a stand-in for
// GitHub on disk, and node tools/live.mjs looked at a stand-in for GitHub
// Pages that answered 404 until the person had switched Pages on. pushed.txt
// is the log of what reached the stand-in GitHub, newest first; report.md is
// what the agent told the person. See fixtures/README.md.
const pushedCommits = async () =>
  (await read("./fixtures/deploy-run/pushed.txt"))
    .split(/^commit /m)
    .filter(Boolean)
    .map((entry) => {
      const [subject, ...files] = entry.trim().split("\n").filter(Boolean);
      return { subject, files };
    });

test("Ops run: it published the later roles' work in one commit, without the stray CV", async () => {
  const published = (await pushedCommits()).find((commit) => commit.subject === "Publish my portfolio");
  assert.ok(published, "no commit 'Publish my portfolio' reached GitHub");
  assert.deepEqual(published.files.sort(), ["site/assets/styles.css", "site/index.html", "site/privacy.html"]);
  for (const commit of await pushedCommits()) assert.ok(!commit.files.some((file) => /CV/i.test(file)), commit.subject);
});

test("Ops run: after the person switched Pages on, it published again", async () => {
  const [newest] = await pushedCommits();
  assert.equal(newest.subject, "Publish again");
  assert.deepEqual(newest.files, []);
});

test("Ops run: it named the CV, explained the Pages setting and reported the live address", async () => {
  const report = await read("./fixtures/deploy-run/report.md");
  const agentSaid = report.split(/^\*\*Person:\*\*/m).map((turn) => turn.split(/^\*\*Agent:\*\*/m).slice(1).join("")).join("\n");
  assert.match(agentSaid, /My CV\.pdf/);
  assert.match(agentSaid, /Source/);
  assert.match(agentSaid, /GitHub Actions/);
  assert.match(agentSaid, /https:\/\/ada-example\.github\.io\/portfolio\//);
  assert.match(agentSaid, /live/i);
});
