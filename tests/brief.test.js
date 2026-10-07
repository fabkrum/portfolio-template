import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { briefNotes, checkBrief } from "../tools/brief/check-brief.mjs";

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

// A brief from before the style, the signature move and the order of the
// sections existed: the Stitch brief of a proxy run. With them added, as the
// Designer writes them now.
const olderBrief = await read("./fixtures/design/briefs/from-stitch-html.md");
const STYLE = `## Style

- Style: Playful, with a Technical touch: monospace dates.
- Feel: energetic, curious, honest.
- Personal detail: a small pixel-art climber next to the name, as the logo.
- Motion: small and springy; when the visitor prefers reduced motion, nothing moves.
`;
const SIGNATURE = `## Signature

- Move: Stickers with a spring
- Guide: guides/ui-behaviors/physics-based-easing.md
- Where: the skill stickers, on hover and keyboard focus.
`;
const ORDER = `## Sections

1. \`bio\`: name, headline, bio.
2. \`projects\`: the three projects lead, the goal is a first job.
3. \`links\`
4. \`cv\`
`;
const withNew = (...sections) => `${olderBrief.trimEnd()}\n\n${sections.join("\n")}`;
const newBrief = withNew(STYLE, SIGNATURE, ORDER);

test("a brief with a style, one signature move and the order of the sections is ready for the Developer", () => {
  assert.deepEqual(checkBrief(newBrief), []);
});

test("the style, the signature move and the order of the sections are optional: a brief without them is still ready", () => {
  for (const sections of [[STYLE], [SIGNATURE], [ORDER], [STYLE, ORDER]]) {
    assert.deepEqual(checkBrief(withNew(...sections)), [], sections.join("\n"));
  }
});

for (const [heading, section] of [["Style", STYLE], ["Signature", SIGNATURE], ["Sections", ORDER]]) {
  test(`an empty ${heading} section says so`, () => {
    const brief = newBrief.replace(section, `## ${heading}\n\n`);
    const problems = checkBrief(brief);
    assert.ok(problems.some((problem) => problem.includes(`"${heading}"`) && /empty/.test(problem)), problems.join("\n"));
  });
}

test("a Style section that names none of the five styles lists them", () => {
  const problems = checkBrief(newBrief.replace("- Style: Playful, with a Technical touch: monospace dates.", "- Style: Cosy, with a retro touch."));
  assert.equal(problems.length, 1, problems.join("\n"));
  for (const style of ["Classic", "Modern", "Bold", "Playful", "Technical"]) assert.ok(problems[0].includes(style), problems[0]);
});

test("a Style section without a line that names the style says so, even when another line names one", () => {
  // "Bold" as a feeling is not the style.
  const brief = newBrief.replace("- Style: Playful, with a Technical touch: monospace dates.\n", "").replace("energetic, curious, honest", "bold, curious, honest");
  const problems = checkBrief(brief);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /"Style"/);
  assert.match(problems[0], /- Style:/);
});

test("a mix of three styles says that two is the most, and that the first one wins", () => {
  const problems = checkBrief(newBrief.replace("- Style: Playful, with a Technical touch: monospace dates.", "- Style: Playful, Bold and Technical."));
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /at most two/);
  assert.match(problems[0], /first/);
});

test("a signature move that is not on the menu says so and names the menu", () => {
  const problems = checkBrief(newBrief.replace("guides/ui-behaviors/physics-based-easing.md", "guides/ui-atoms/state-aware-sticky-headers.md"));
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /state-aware-sticky-headers\.md/);
  assert.match(problems[0], /\.agents\/skills\/build\/signatures\.md/);
});

test("a Signature section without the guide of its move says so", () => {
  const problems = checkBrief(newBrief.replace("- Guide: guides/ui-behaviors/physics-based-easing.md\n", ""));
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /"Signature"/);
  assert.match(problems[0], /guide/);
});

test("two signature moves say that a site gets exactly one", () => {
  const brief = newBrief.replace(
    "- Guide: guides/ui-behaviors/physics-based-easing.md",
    "- Guide: guides/ui-behaviors/physics-based-easing.md\n- Also: guides/ui-atoms/scroll-progress-indicator.md",
  );
  const problems = checkBrief(brief);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /exactly one/);
});

test("a third font for dates and labels is optional, but a details row without a font says so", () => {
  const withDetails = (font) =>
    newBrief.replace(/^(\| body \|.*\n)/m, `$1| details | ${font} | dates 0.875rem | 400 |\n`);
  assert.deepEqual(checkBrief(withDetails('"JetBrains Mono", ui-monospace, monospace')), []);
  const problems = checkBrief(withDetails(""));
  assert.ok(problems.some((problem) => problem.includes('"details"') && /font/i.test(problem)), problems.join("\n"));
});

// The families in fonts/, by name, as the command finds them.
const BUNDLED = ["Newsreader", "Literata", "Geist", "JetBrains Mono", "Anton", "Work Sans", "Bricolage Grotesque", "Rubik", "IBM Plex Sans"];
const withFonts = (brief, headings, body) =>
  brief
    .replace(/^\| headings \| [^|]* \|/m, `| headings | ${headings} |`)
    .replace(/^\| body \| [^|]* \|/m, `| body | ${body} |`);

test("a web font that is neither bundled nor on every computer is good to know, not a problem", () => {
  // The Stitch brief of the proxy run names Plus Jakarta Sans, from Google Fonts.
  assert.deepEqual(checkBrief(olderBrief), []);
  const notes = briefNotes(olderBrief, { bundled: BUNDLED });
  const fontNotes = notes.filter((note) => note.includes('"Plus Jakarta Sans"'));
  assert.equal(fontNotes.length, 1, notes.join("\n"));
  assert.match(fontNotes[0], /fonts\//);
  for (const family of BUNDLED) assert.ok(fontNotes[0].includes(family), family);
});

test("bundled fonts, fonts on every computer and font stacks in backticks need no note", () => {
  for (const [headings, body] of [
    ['"Newsreader", Georgia, serif', '"Literata", Georgia, serif'],
    ["`\"Bricolage Grotesque\", system-ui, sans-serif`", "'Rubik', system-ui, sans-serif"],
    ['Georgia, "Times New Roman", serif', "system-ui, sans-serif"],
    ["ui-monospace, Menlo, Consolas, monospace", '"IBM Plex Sans", system-ui, sans-serif'],
  ]) {
    const notes = briefNotes(withFonts(newBrief, headings, body), { bundled: BUNDLED });
    assert.deepEqual(notes, [], `${headings} / ${body}`);
  }
});

test("a brief without a style, a signature move or the order of the sections hears that the Developer builds without them", () => {
  const notes = briefNotes(withFonts(olderBrief, '"Geist", system-ui, sans-serif', '"Geist", system-ui, sans-serif'), { bundled: BUNDLED });
  assert.equal(notes.length, 1, notes.join("\n"));
  for (const heading of ["Style", "Signature", "Sections"]) assert.ok(notes[0].includes(`"${heading}"`), notes[0]);
});

test("the command says the brief is ready, then what is good to know about its fonts, and the fonts in fonts/ count as bundled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brief-"));
  try {
    const path = join(dir, "brief.md");
    await writeFile(path, newBrief);
    const unbundled = runCommand(path);
    assert.equal(unbundled.status, 0);
    assert.match(unbundled.stdout, /is ready for the Developer/);
    assert.match(unbundled.stdout, /Good to know/);
    assert.match(unbundled.stdout, /"Plus Jakarta Sans"/);
    await writeFile(path, withFonts(newBrief, '"Anton", Impact, sans-serif', '"Work Sans", system-ui, sans-serif'));
    const bundled = runCommand(path);
    assert.match(bundled.stdout, /is ready for the Developer/);
    assert.doesNotMatch(bundled.stdout, /Good to know/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
