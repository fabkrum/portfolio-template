import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkBrief } from "../tools/brief/check-brief.mjs";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const repoDir = fileURLToPath(new URL("..", import.meta.url));

// The command as the Designer skill runs it, from the repo folder.
const runCommand = (...args) =>
  spawnSync(process.execPath, ["tools/check-brief.mjs", ...args], { cwd: repoDir, encoding: "utf8" });

const defaultBrief = await read("../design/brief.md");

// The default brief with one "## " section cut out.
const withoutSection = (heading) =>
  defaultBrief.replace(new RegExp(`## ${heading}\\n[\\s\\S]*?(?=\\n## |$)`), "");

test("the default design brief is complete and readable", () => {
  assert.deepEqual(checkBrief(defaultBrief), []);
});

test("a brief with Windows line endings is read the same way", () => {
  assert.deepEqual(checkBrief(defaultBrief.replaceAll("\n", "\r\n")), []);
});

for (const heading of ["Colours", "Type", "Shapes", "Layout", "Components"]) {
  test(`a brief without the ${heading} section says so`, () => {
    const problems = checkBrief(withoutSection(heading));
    assert.ok(
      problems.some((problem) => problem.includes(`"${heading}"`)),
      problems.join("\n"),
    );
  });
}

test("a brief without one of the six colour tokens names the missing token", () => {
  const brief = defaultBrief.replace(/^\| on-accent \|.*\n/m, "");
  const problems = checkBrief(brief);
  assert.ok(problems.some((problem) => problem.includes('"on-accent"')), problems.join("\n"));
});

test("text too light to read on its background is named with its contrast", () => {
  // #777777 on white is 4.48:1, just under the 4.5:1 that WCAG AA asks for.
  const brief = defaultBrief.replace("| muted | #5a5a66 |", "| muted | #777777 |");
  const problems = checkBrief(brief);
  assert.equal(problems.length, 2, problems.join("\n")); // on background and on surface
  assert.ok(problems.some((problem) => /"muted" on "background" \(Light\).*4\.48:1/.test(problem)), problems.join("\n"));
});

test("text on an accent-coloured button must be readable too", () => {
  const brief = defaultBrief.replace("| on-accent | #ffffff | #121216 |", "| on-accent | #ffffff | #ffffff |");
  const problems = checkBrief(brief);
  assert.ok(problems.some((problem) => problem.includes('"on-accent" on "accent" (Dark)')), problems.join("\n"));
});

for (const heading of ["Shapes", "Layout", "Components"]) {
  test(`an empty ${heading} section says so`, () => {
    const brief = withoutSection(heading).replace("## Colours", `## ${heading}\n\n## Colours`);
    const problems = checkBrief(brief);
    assert.ok(problems.some((problem) => problem.includes(`"${heading}"`) && /empty/.test(problem)), problems.join("\n"));
  });
}

test("the default brief also ships as a copy the Designer can always go back to", async () => {
  assert.equal(await read("../design/default-brief.md"), defaultBrief);
});

test("a type table without a font for body text says so", () => {
  const brief = defaultBrief.replace(/^\| body \|.*\n/m, "| body |  | 1rem | 400 |\n");
  const problems = checkBrief(brief);
  assert.ok(problems.some((problem) => problem.includes('"body"') && /font/i.test(problem)), problems.join("\n"));
});

test("a type table without a headings row says so", () => {
  const brief = defaultBrief.replace(/^\| headings \|.*\n/m, "");
  const problems = checkBrief(brief);
  assert.ok(problems.some((problem) => problem.includes('"headings"')), problems.join("\n"));
});

test("a colour that is not a hex value is named with its mode", () => {
  const brief = defaultBrief.replace("| surface | #f4f4f6 | #1c1c22 |", "| surface | #f4f4f6 | dark grey |");
  const problems = checkBrief(brief);
  assert.ok(
    problems.some((problem) => problem.includes('"surface"') && problem.includes("Dark") && problem.includes("dark grey")),
    problems.join("\n"),
  );
});

test("the command says the default brief is ready", () => {
  const { stdout, status } = runCommand();
  assert.equal(status, 0);
  assert.match(stdout, /design\/brief\.md is ready for the Developer/);
});

test("the command lists every problem of a brief and still exits 0", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brief-"));
  try {
    const path = join(dir, "brief.md");
    await writeFile(path, withoutSection("Layout").replace("| muted | #5a5a66 |", "| muted | #777777 |"));
    const { stdout, status } = runCommand(path);
    assert.equal(status, 0);
    assert.match(stdout, /"Layout"/);
    assert.match(stdout, /"muted" on "background" \(Light\)/);
    assert.match(stdout, /3 things to fix/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the command says plainly when there is no brief", () => {
  const { stdout, status } = runCommand("design/no-such-brief.md");
  assert.equal(status, 0);
  assert.match(stdout, /There is no design brief at/);
});

test("Antigravity finds the Designer skill in the workspace skills folder", async () => {
  const skill = await read("../.agents/skills/design/SKILL.md");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  assert.match(frontmatter, /^name: design$/m);
  assert.match(frontmatter, /^description: .*Stitch.*$/m);
});

test("the Designer skill writes the brief the Developer reads and checks it", async () => {
  const skill = await read("../.agents/skills/design/SKILL.md");
  assert.ok(skill.includes("design/brief.md"));
  assert.ok(skill.includes("node tools/check-brief.mjs"));
  // Every section the brief needs is spelled out in the skill's template.
  for (const heading of ["Colours", "Type", "Shapes", "Layout", "Components"]) {
    assert.ok(skill.includes(`## ${heading}`), heading);
  }
});

// Briefs the Designer skill wrote in proxy runs on the two Stitch inputs in
// tests/fixtures/design/; the Developer must be able to build from each.
const proxyBriefs = new URL("./fixtures/design/briefs/", import.meta.url);
for (const name of (await readdir(proxyBriefs)).filter((file) => file.endsWith(".md"))) {
  test(`the brief the skill wrote ${name.replace(".md", "").replaceAll("-", " ")} is ready for the Developer`, async () => {
    assert.deepEqual(checkBrief(await read(`./fixtures/design/briefs/${name}`)), []);
  });
}
