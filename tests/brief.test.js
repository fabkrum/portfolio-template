import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { briefNotes, checkBrief, contrast, firstFont, SIGNATURE_GUIDES, STYLES } from "../tools/brief/check-brief.mjs";
import { bundledFonts } from "../tools/fonts/bundled-fonts.mjs";

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

// The default brief with one colour token's Light or Dark value replaced.
const withColour = (brief, token, { light, dark }) =>
  brief.replace(new RegExp(`^\\| ${token} \\| ([^|]*) \\| ([^|]*) \\|`, "m"), (_, oldLight, oldDark) => `| ${token} | ${light ?? oldLight} | ${dark ?? oldDark} |`);

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
  const brief = withColour(withColour(defaultBrief, "background", { light: "#ffffff" }), "muted", { light: "#777777" });
  const problems = checkBrief(brief);
  assert.equal(problems.length, 2, problems.join("\n")); // on background and on surface
  assert.ok(problems.some((problem) => /"muted" on "background" \(Light\).*4\.48:1/.test(problem)), problems.join("\n"));
});

test("text on an accent-coloured button must be readable too", () => {
  const brief = withColour(defaultBrief, "on-accent", { dark: "#ffffff" });
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
  const brief = withColour(defaultBrief, "surface", { dark: "dark grey" });
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
    await writeFile(path, withColour(withoutSection("Layout"), "muted", { light: "#777777" }));
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

test("a mix's cue may use a style's name as a plain word: only the styles before the cue count", () => {
  for (const line of [
    "- Style: Playful, with a Technical touch: monospace dates in bold.",
    "- Style: Classic, with a Modern touch: lots of whitespace, and a bold serif name.",
    "- Style: Classic (with a bold name).",
  ]) {
    assert.deepEqual(checkBrief(newBrief.replace("- Style: Playful, with a Technical touch: monospace dates.", line)), [], line);
  }
});

test("a move named on the menu must come with its own guide", () => {
  const problems = checkBrief(newBrief.replace("- Move: Stickers with a spring", "- Move: Reading progress line"));
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], /"Reading progress line" goes with the guide guides\/ui-atoms\/scroll-progress-indicator\.md/);
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

test("without a font folder, the note about a web font names no bundled fonts to choose from", () => {
  const notes = briefNotes(olderBrief, { bundled: [] });
  assert.ok(notes.some((note) => note.includes('"Plus Jakarta Sans"')), notes.join("\n"));
  for (const note of notes) assert.doesNotMatch(note, /choose one that is bundled/);
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

// The command the Designer runs for the person's colour on the page background.
const contrastCommand = (...args) =>
  spawnSync(process.execPath, ["tools/contrast.mjs", ...args], { cwd: repoDir, encoding: "utf8" });

test("the contrast command says whether a colour is readable as text on a background, or belongs behind dark text", () => {
  const bright = contrastCommand("FF6A2B", "FFF8EC");
  assert.equal(bright.status, 0);
  assert.match(bright.stdout, /2\.71:1/);
  assert.match(bright.stdout, /behind dark text/);
  // With the # as well, as the person may write it.
  const ink = contrastCommand("#A8402F", "#f7f3ec");
  assert.match(ink.stdout, /5\.52:1/);
  assert.match(ink.stdout, /readable as text/i);
  assert.doesNotMatch(ink.stdout, /behind dark text/);
  // 4.48:1 is shown as such, never rounded up to 4.5.
  assert.match(contrastCommand("777777", "ffffff").stdout, /4\.48:1.*too light/is);
});

test("the contrast command explains how to call it when a colour is missing or not a hex value", () => {
  for (const args of [[], ["orange", "FFF8EC"], ["FF6A2B"]]) {
    const run = contrastCommand(...args);
    assert.equal(run.status, 0);
    assert.match(run.stdout, /node tools\/contrast\.mjs FF6A2B FFF8EC/, args.join(" "));
  }
});

// The Designer's phrase bank: one "## " part per style, each line "- Key: value".
const phraseBank = await read("../.agents/skills/design/styles.md");
const styleParts = Object.fromEntries(
  phraseBank.split(/^## /m).slice(1).map((part) => [part.split("\n")[0].trim(), part]),
);
const lineIn = (part, key) => part.match(new RegExp(`^- ${key}:(.*)$`, "m"))?.[1].trim();
const designerSkill = await read("../.agents/skills/design/SKILL.md");
// The fenced blocks of a Markdown text, with their language.
const blocksIn = (markdown) => [...markdown.matchAll(/^```(\w*)\n([\s\S]*?)^```$/gm)].map(([, language, body]) => ({ language, body }));

test("the phrase bank has every line for each of the five styles", () => {
  for (const style of STYLES) {
    const part = styleParts[style];
    assert.ok(part, `no part for ${style}`);
    for (const key of ["Offer", "More examples", "Phrase", "Touch", "Feel", "Fonts", "Background", "Skills", "Photo", "Leave out", "Motion", "Signature", "Brief"]) {
      assert.ok(lineIn(part, key) !== undefined, `${style}: ${key}`);
    }
    assert.match(lineIn(part, "Offer"), /^\*\*\w+\*\*: .+\. Like [\w.-]+\.\w+\.$/, `${style}: one sentence and one example site`);
    for (const role of ["headings", "body", "details"]) assert.match(part, new RegExp(`^  - ${role}: \`[^\`]+\`$`, "m"), `${style}: ${role}`);
    // Never a URL in a phrase that goes into the prompt.
    for (const key of ["Phrase", "Touch", "Skills", "Photo", "Leave out"]) assert.doesNotMatch(lineIn(part, key), /https?:|www\.|\.(com|dev|me|nl|co|as)\b/, `${style}: ${key}`);
    assert.equal(lineIn(part, "Feel").split(", ").length, 3, `${style}: three words to feel`);
  }
});

test("every font the phrase bank names is in the font folder, with its licence", async () => {
  const bundled = await bundledFonts(repoDir);
  for (const style of STYLES) {
    const part = styleParts[style];
    const stacks = [...part.matchAll(/^ {2}- (?:headings|body|details): `([^`]+)`$/gm)].map(([, stack]) => stack);
    const named = [...lineIn(part, "Fonts").matchAll(/in ([A-Z][\w ]+?)(?=[,.]| and)/g)].map(([, font]) => font.trim());
    assert.ok(named.length >= 2, `${style}: ${lineIn(part, "Fonts")}`);
    for (const font of [...stacks.map(firstFont), ...named]) {
      const family = bundled.find(({ name }) => name === font);
      assert.ok(family, `${style}: ${font} is not in fonts/`);
      assert.ok(family.files.includes("OFL.txt"), `${font} has no licence`);
    }
  }
});

test("the phrase bank marks exactly the default accents that are too light for text as fills behind dark text", () => {
  for (const style of STYLES) {
    const [background, accent] = lineIn(styleParts[style], "Background").match(/#[0-9A-F]{6}/gi);
    const tooLight = contrast(accent, background) < 4.5;
    assert.equal(/fills behind dark text/.test(lineIn(styleParts[style], "Background")), tooLight, `${style}: ${accent} on ${background}`);
  }
});

test("each style suggests signature moves from the menu, each with its guide", () => {
  for (const style of STYLES) {
    const moves = styleParts[style].split("- Signature:")[1].split("\n").filter((line) => line.startsWith("  - "));
    assert.ok(moves.length >= 2, style);
    for (const move of moves) assert.ok(SIGNATURE_GUIDES.some((guide) => move.endsWith(`\`${guide}\``)), `${style}: ${move}`);
  }
});

test("the Designer offers the five styles, each in one sentence with one example site, and default for someone with no time", () => {
  const opening = designerSkill.split("## 2. Ask for the style")[1].split("\n- ")[0];
  for (const style of STYLES) {
    const offer = opening.match(new RegExp(`^\\d\\. \\*\\*${style}\\*\\*: [^\\n]+$`, "m"))?.[0];
    assert.ok(offer, style);
    assert.equal(offer.replace(/^\d\. /, ""), lineIn(styleParts[style], "Offer"), `${style}: the offer and the phrase bank agree`);
  }
  assert.match(opening, /mix two/);
  assert.match(opening, /\*\*default\*\*/);
});

test("the Designer interviews in at most five questions, one at a time, and asks once for a sharper word", () => {
  for (const needed of [/\*\*At most five questions\*\*/, /\*\*One question at a time\.\*\*/, /sharper word/, /counts as a question/, /exactly one small detail/, /Never a whole design/, /Never ask both/]) {
    assert.match(designerSkill, needed);
  }
  // The goal comes from the spec, the content from the content file.
  for (const needed of ["docs/spec.md", "site/content.json", "a job", "freelance clients", "speaking invitations", "community"]) {
    assert.ok(designerSkill.includes(needed), needed);
  }
});

test("the Stitch prompt follows Google's recipe, in English, with no web address and only bundled fonts", async () => {
  const prompts = blocksIn(designerSkill).filter(({ body }) => body.startsWith("Idea: "));
  assert.equal(prompts.length, 2, "the template and the example");
  for (const { body } of prompts) {
    assert.deepEqual(body.trim().split("\n").map((line) => line.split(":")[0]), ["Idea", "Theme", "Content", "Image", "Leave out"]);
    assert.match(body, /Leave out: .*made-up numbers\.$/m);
  }
  const example = prompts[1].body;
  assert.doesNotMatch(example, /https?:|www\.|\.(com|dev|me|io)\b/);
  const bundled = (await bundledFonts(repoDir)).map(({ name }) => name);
  for (const [, font] of example.matchAll(/(?:Headings|text|dates) in ([A-Z][\w ]+?)(?=[,.])/g)) assert.ok(bundled.includes(font), font);
  for (const needed of [/in English/, /Never put a web address into the Stitch prompt/, /about 120 words/, /node tools\/contrast\.mjs/, /fills behind dark text/, /Motion stays out of the prompt/]) {
    assert.match(designerSkill, needed);
  }
});

// Fabian, 2026-10-10: the hand-over sends the person back to the guide's
// Stitch step; the agent explains Stitch only when asked or without a guide.
test("the Designer's hand-over sends the person back to the guide, then asks for the design in the same chat", () => {
  const handOver = designerSkill.split("## 5. Hand the prompt over")[1]?.split("\n## ")[0] ?? "";
  const message = handOver.match(/^"Here is your Stitch prompt\.([\s\S]*?)"$/m)?.[1] ?? "";
  assert.match(message, /go back to the workshop guide, to the step \*\*Design it in Stitch\*\*/);
  assert.match(message, /come back to this chat and show it to me/);
  assert.doesNotMatch(message, /stitch\.withgoogle\.com|\*\*Speed\*\*/);
  assert.match(handOver, /Do not explain Stitch in this message/);
});

test("the Designer tells the person how to use the prompt in Stitch", () => {
  for (const needed of [/\*\*Web\*\*/, /Switch on \*\*Speed\*\*/, /send it as it is/, /offers to enhance or improve your prompt, say \*\*no\*\*/, /one thing at a time/, /\*\*Edit Theme\*\*/, /\*\*Creative\*\*/, /Make it more STYLE/, /\*\*no Stitch\*\*/]) {
    assert.match(designerSkill, needed);
  }
});

test("the brief template in the Designer skill has the style, a third font, the signature move and the order of the sections", () => {
  const template = blocksIn(designerSkill).find(({ language, body }) => language === "markdown" && body.startsWith("# Design brief"))?.body ?? "";
  for (const heading of ["Style", "Colours", "Type", "Shapes", "Layout", "Components", "Signature", "Sections"]) {
    assert.ok(template.includes(`\n## ${heading}\n`), heading);
  }
  assert.match(template, /^\| details \|/m);
  for (const line of ["- Style:", "- Feel:", "- Personal detail:", "- Motion:", "- Move:", "- Guide:", "1. `bio`"]) assert.ok(template.includes(line), line);
});

// The ready brief of each style, for a brief without Stitch.
const readyBrief = (style) => read(`../.agents/skills/design/${lineIn(styleParts[style], "Brief").replaceAll("`", "")}`);

test("without Stitch, the Designer starts from the style's ready brief and the answers, never from the default brief", () => {
  const section = designerSkill.split("## 6c. Without Stitch")[1]?.split("\n## ")[0] ?? "";
  for (const needed of [/Never fall back to the default brief/, /\*\*Brief\*\*/, /Source: the interview, without Stitch/]) assert.match(section, needed);
  assert.match(designerSkill, /\*\*no Stitch\*\*, or any message that they cannot use Stitch: go to step 6c/);
  assert.match(designerSkill, /\*\*default\*\* is only for someone with no time for the interview/);
});

for (const style of STYLES) {
  test(`the ready ${style} brief is ready for the Developer, in the fonts, signature move and colours of the phrase bank`, async () => {
    const brief = await readyBrief(style);
    assert.deepEqual(checkBrief(brief), []);
    assert.deepEqual(briefNotes(brief, { bundled: (await bundledFonts(repoDir)).map(({ name }) => name) }), []);
    assert.match(brief, /^Source: the interview, without Stitch$/m);
    assert.match(brief, new RegExp(`^- Style: ${style}\\.$`, "m"));
    assert.match(brief, new RegExp(`^- Feel: ${lineIn(styleParts[style], "Feel")}\\.$`, "m"));
    // The font stacks of the phrase bank, row by row.
    for (const role of ["headings", "body", "details"]) {
      const stack = styleParts[style].match(new RegExp(`^ {2}- ${role}: \`([^\`]+)\`$`, "m"))[1];
      assert.match(brief, new RegExp(`^\\| ${role} \\| ${stack.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`, "m"), `${style}: ${role}`);
    }
    // Its signature move is the style's first suggestion.
    const [, move, guide] = styleParts[style].match(/^ {2}- ([^:`]+): `(guides\/[^`]+)`$/m);
    assert.ok(brief.includes(`- Move: ${move}\n- Guide: ${guide}`), `${style}: ${move}`);
    // Its background is the style's.
    const background = lineIn(styleParts[style], "Background").match(/#[0-9A-F]{6}/i)[0];
    assert.match(brief, new RegExp(`^\\| background \\| ${background} \\|`, "im"));
  });
}

test("the ready Classic brief is the default design, but for where it comes from and the personal detail", async () => {
  const without = (brief) => brief.replace(/^Source: .*$/m, "").replace(/^- Personal detail: .*$/m, "");
  assert.equal(without(await readyBrief("Classic")), without(defaultBrief));
});
