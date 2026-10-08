import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { runCheck } from "../tools/check/run-check.mjs";
import { inChrome } from "./in-chrome.js";
import { participantRepo, templateDir, withRepo } from "./participant-repo.js";
import { toolCallsIn, turnsIn } from "./proxy-report.js";
import { lightDarkTokens } from "./site-files.js";

// A participant's own files: the Italian content file and the spec of the
// Analyst's CV run, and the brief the Designer wrote from Stitch's HTML.
const OWN = {
  "site/content.json": "tests/fixtures/analyst-runs/cv/site/content.json",
  "design/brief.md": "tests/fixtures/design/briefs/from-stitch-html.md",
  "docs/spec.md": "tests/fixtures/analyst-runs/cv/spec.md",
};

// The one documented action, run the way a participant runs it.
const jumpTo = (dir, role) =>
  spawnSync(process.execPath, [join(dir, "tools", "checkpoint.mjs"), role], { cwd: dir, encoding: "utf8" });

const checkOf = async (dir) => Object.fromEntries((await runCheck(join(dir, "site"))).map((item) => [item.id, item]));

// The six colours of design/default-brief.md.
const DEFAULT_COLOURS = {
  background: { Light: "#f7f3ec", Dark: "#1b1714" },
  surface: { Light: "#eee7dc", Dark: "#26201c" },
  text: { Light: "#231e1a", Dark: "#eee6dc" },
  muted: { Light: "#675c52", Dark: "#b3a698" },
  accent: { Light: "#a8402f", Dark: "#f0937d" },
  "on-accent": { Light: "#ffffff", Dark: "#1b1714" },
};

// One checkpoint per block, in the order of the blocks. The privacy page is
// the Lawyer's, so before the Lawyer's block it still needs attention.
const BLOCKS = ["analyst", "designer", "developer", "qa", "lawyer", "ops"];
const LAWYER_DONE = new Set(["lawyer", "ops"]);

for (const role of BLOCKS) {
  test(`the ${role} checkpoint on a fresh copy: the Check passes ${LAWYER_DONE.has(role) ? "every item" : "all but the Lawyer's legal page"}`, async () => {
    await withRepo(async (dir) => {
      const run = jumpTo(dir, role);
      assert.equal(run.status, 0, run.stdout + run.stderr);
      for (const item of Object.values(await checkOf(dir))) {
        assert.equal(item.pass, item.id !== "legal" || LAWYER_DONE.has(role), `${item.id}: ${item.details}`);
      }
    });
  });
}

test("the Developer's checkpoint gives the site the Developer's design, and the Check passes all but the Lawyer's item", async () => {
  await withRepo(async (dir) => {
    const run = jumpTo(dir, "developer");
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const css = await readFile(join(dir, "site", "assets", "styles.css"), "utf8");
    assert.deepEqual(lightDarkTokens(css), DEFAULT_COLOURS);
    for (const item of Object.values(await checkOf(dir))) assert.equal(item.pass, item.id !== "legal", `${item.id}: ${item.details}`);
  });
});

for (const role of BLOCKS) {
  test(`the ${role} checkpoint keeps the person's own content file, design brief and spec, byte for byte`, async () => {
    await withRepo(OWN, async (dir) => {
      const run = jumpTo(dir, role);
      assert.equal(run.status, 0, run.stdout + run.stderr);
      for (const [file, from] of Object.entries(OWN)) {
        assert.ok((await readFile(join(dir, file))).equals(await readFile(join(templateDir, from))), file);
      }
      for (const item of Object.values(await checkOf(dir))) {
        assert.equal(item.pass, item.id !== "legal" || LAWYER_DONE.has(role), `${item.id}: ${item.details}`);
      }
    });
  });
}

// A participant who fell behind in the Developer's block: their agent broke
// render.js, left the stylesheet half written and deleted the privacy page.
test("a checkpoint brings back the code an agent broke, and the site works again", async () => {
  await withRepo(OWN, async (dir) => {
    await writeFile(join(dir, "site", "assets", "render.js"), "export function renderSections( {");
    await writeFile(join(dir, "site", "assets", "styles.css"), ":root { --muted: #f4f4f4; } .headline { color: var(--muted)");
    await rm(join(dir, "site", "privacy.html"));
    assert.equal((await checkOf(dir)).console.pass, false, "the broken render.js shows no console error");
    const run = jumpTo(dir, "developer");
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const items = await checkOf(dir);
    for (const item of Object.values(items)) assert.equal(item.pass, item.id !== "legal", `${item.id}: ${item.details}`);
    assert.match(items.legal.details.join("\n"), /placeholder/);
  });
});

// Every file below site/, design/ and docs/ of a repo, as { "site/index.html": <bytes>, … }.
async function repoFiles(dir) {
  const files = {};
  for (const part of ["site", "design", "docs"]) {
    for (const entry of await readdir(join(dir, part), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const path = join(entry.parentPath, entry.name);
      files[relative(dir, path).replaceAll("\\", "/")] = await readFile(path);
    }
  }
  return files;
}

test("the Analyst's checkpoint is the template as it ships: applied to a fresh copy, it changes no file", async () => {
  await withRepo(async (dir) => {
    const run = jumpTo(dir, "analyst");
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.deepEqual(await repoFiles(dir), await repoFiles(templateDir));
  });
});

test("someone with no content file, design brief or spec gets the sample person, the default brief and the sample spec", async () => {
  await withRepo(async (dir) => {
    for (const file of Object.keys(OWN)) await rm(join(dir, file));
    const run = jumpTo(dir, "developer");
    assert.equal(run.status, 0, run.stdout + run.stderr);
    for (const [file, sample] of [["site/content.json", "site/content.json"], ["design/brief.md", "design/default-brief.md"], ["docs/spec.md", "docs/spec.md"]]) {
      assert.ok((await readFile(join(dir, file))).equals(await readFile(join(templateDir, sample))), file);
    }
    for (const item of Object.values(await checkOf(dir))) assert.equal(item.pass, item.id !== "legal", `${item.id}: ${item.details}`);
  });
});

// The colours and fonts of tests/fixtures/design/briefs/from-stitch-html.md.
const STITCH_COLOURS = {
  background: { Light: "#f7f5f0", Dark: "#10201e" },
  surface: { Light: "#ece7dc", Dark: "#1a2e2b" },
  text: { Light: "#1c1917", Dark: "#f5f5f4" },
  muted: { Light: "#57534e", Dark: "#a8a29e" },
  accent: { Light: "#095f59", Dark: "#5eead4" },
  "on-accent": { Light: "#ffffff", Dark: "#1c1917" },
};
const STITCH_FONTS = '"Plus Jakarta Sans", system-ui, sans-serif';

for (const role of ["developer", "qa", "lawyer", "ops"]) {
  test(`the ${role} checkpoint takes the colours and fonts of the person's own brief`, async () => {
    await withRepo(OWN, async (dir) => {
      const run = jumpTo(dir, role);
      assert.equal(run.status, 0, run.stdout + run.stderr);
      const css = await readFile(join(dir, "site", "assets", "styles.css"), "utf8");
      assert.deepEqual(lightDarkTokens(css), STITCH_COLOURS);
      assert.ok(css.includes(`--font-heading: ${STITCH_FONTS};`), "heading font");
      assert.ok(css.includes(`--font-body: ${STITCH_FONTS};`), "body font");
    });
  });
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const today = () => new Date();
// Git on Windows may check files out with CRLF line endings.
const readText = async (path) => (await readFile(path, "utf8")).replaceAll("\r\n", "\n");

test("the Lawyer's checkpoint writes the legal page for the sample person as the Lawyer's template, dated today", async () => {
  await withRepo(async (dir) => {
    assert.equal(jumpTo(dir, "lawyer").status, 0);
    const page = await readText(join(dir, "site", "privacy.html"));
    const date = page.match(/Last updated: (\d{1,2}) (\w+) (\d{4})</);
    assert.ok(date, "no date");
    assert.deepEqual([Number(date[1]), date[2], Number(date[3])], [today().getDate(), MONTHS[today().getMonth()], today().getFullYear()]);
    const finished = await readText(join(templateDir, "tests", "fixtures", "finished-privacy", "privacy.html"));
    assert.equal(page.replace(date[0], "Last updated: 4 October 2026<"), finished);
  });
});

test("the Lawyer's checkpoint writes the legal page for the person in their own content file, in English", async () => {
  await withRepo(OWN, async (dir) => {
    assert.equal(jumpTo(dir, "lawyer").status, 0);
    const page = await readText(join(dir, "site", "privacy.html"));
    for (const needed of ['<html lang="en">', "<title>Legal notice &amp; privacy · Giulia Placeholder</title>", "personal portfolio of Giulia Placeholder", '<a href="mailto:giulia@example.com">giulia@example.com</a>']) {
      assert.ok(page.includes(needed), needed);
    }
    assert.ok(!page.includes("Ada Example"));
  });
});

// The legal page the Lawyer wrote for Giulia, in Italian.
const giuliasPrivacyPage = async () =>
  (await readText(join(templateDir, "tests", "fixtures", "finished-privacy", "privacy.html")))
    .replace('<html lang="en">', '<html lang="it">')
    .replace("<h1>Legal notice &amp; privacy</h1>", "<h1>Note legali e privacy</h1>")
    .replaceAll("Ada Example", "Giulia Placeholder")
    .replaceAll("ada@example.com", "giulia@example.com");

for (const role of ["developer", "lawyer"]) {
  test(`the ${role} checkpoint keeps a legal page the Lawyer has written for the person`, async () => {
    await withRepo(OWN, async (dir) => {
      const page = await giuliasPrivacyPage();
      await writeFile(join(dir, "site", "privacy.html"), page);
      assert.equal(jumpTo(dir, role).status, 0);
      assert.equal(await readText(join(dir, "site", "privacy.html")), page);
      for (const item of Object.values(await checkOf(dir))) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
    });
  });
}

test("a legal page written for someone else is written again for the person in the content file", async () => {
  await withRepo(OWN, async (dir) => {
    await cp(join(templateDir, "tests", "fixtures", "finished-privacy", "privacy.html"), join(dir, "site", "privacy.html"));
    assert.equal(jumpTo(dir, "lawyer").status, 0);
    const page = await readText(join(dir, "site", "privacy.html"));
    assert.ok(page.includes("personal portfolio of Giulia Placeholder"));
    assert.ok(!page.includes("Ada Example"));
  });
});

// What the command tells the person, in plain words.
const NEXT_ROLE = { analyst: "the Designer", designer: "the Developer", developer: "QA", qa: "the Lawyer", lawyer: "Ops", ops: "Ops" };
const BLOCK_NAME = { analyst: "Analyst", designer: "Designer", developer: "Developer", qa: "QA", lawyer: "Lawyer", ops: "Ops" };

for (const role of BLOCKS) {
  test(`the ${role} checkpoint says where the site is now, and to ask for ${NEXT_ROLE[role]} in a fresh chat`, async () => {
    await withRepo(OWN, async (dir) => {
      const { status, stdout } = jumpTo(dir, role);
      assert.equal(status, 0, stdout);
      assert.match(stdout, new RegExp(`end of the ${BLOCK_NAME[role]} block`));
      assert.match(stdout, new RegExp(`start a fresh chat and ask for ${NEXT_ROLE[role]}`));
    });
  });
}

test("the command names what it kept and what it changed, and why the font differs", async () => {
  await withRepo(OWN, async (dir) => {
    const { stdout } = jumpTo(dir, "developer");
    const kept = stdout.slice(stdout.indexOf("Kept"), stdout.indexOf("Changed"));
    for (const file of ["site/content.json", "design/brief.md", "docs/spec.md"]) assert.ok(kept.includes(file), file);
    const changed = stdout.slice(stdout.indexOf("Changed"));
    for (const file of ["site/index.html", "site/assets/styles.css"]) assert.ok(changed.includes(file), file);
    assert.match(changed, /colours and fonts of your design brief/);
    assert.match(stdout, /"Plus Jakarta Sans"/);
  });
});

test("the command says when it put in the sample person, the default brief and the sample spec", async () => {
  await withRepo(async (dir) => {
    for (const file of Object.keys(OWN)) await rm(join(dir, file));
    const { stdout } = jumpTo(dir, "designer");
    const putIn = stdout.slice(stdout.indexOf("Put in"));
    for (const file of ["site/content.json", "design/brief.md", "docs/spec.md"]) assert.ok(putIn.includes(file), file);
    assert.match(putIn, /Ada Example/);
  });
});

test("applied twice, the second time the command changes nothing and says so", async () => {
  await withRepo(OWN, async (dir) => {
    jumpTo(dir, "qa");
    const before = await repoFiles(dir);
    const { status, stdout } = jumpTo(dir, "qa");
    assert.equal(status, 0, stdout);
    assert.deepEqual(await repoFiles(dir), before);
    assert.match(stdout, /Nothing to change/);
    assert.doesNotMatch(stdout, /Changed/);
  });
});

test("with a brief that is not finished, the page keeps the default colours and the command says why", async () => {
  await withRepo(OWN, async (dir) => {
    const brief = await readFile(join(dir, "design", "brief.md"), "utf8");
    await writeFile(join(dir, "design", "brief.md"), brief.replace("| muted | #57534e |", "| muted | #d6d3d1 |"));
    const { status, stdout } = jumpTo(dir, "developer");
    assert.equal(status, 0, stdout);
    assert.deepEqual(lightDarkTokens(await readFile(join(dir, "site", "assets", "styles.css"), "utf8")), DEFAULT_COLOURS);
    assert.match(stdout, /design\/brief\.md is not finished/);
    assert.match(stdout, /"muted" on "background" \(Light\) is hard to read/);
    assert.match(stdout, /default colours and fonts/);
  });
});

test("on a site that is not in English, the command says the legal page is in English", async () => {
  await withRepo(OWN, async (dir) => {
    const { stdout } = jumpTo(dir, "lawyer");
    assert.match(stdout, /Giulia Placeholder/);
    assert.match(stdout, /giulia@example\.com/);
    assert.match(stdout, /Italian/);
    assert.match(stdout, /legal page is in English/);
  });
});

for (const wrong of ["", "developr"]) {
  test(`given ${wrong ? `a wrong name ("${wrong}")` : "no name"}, the command lists the six checkpoints and changes nothing`, async () => {
    await withRepo(OWN, async (dir) => {
      const before = await repoFiles(dir);
      const run = spawnSync(process.execPath, [join(dir, "tools", "checkpoint.mjs"), ...(wrong ? [wrong] : [])], { cwd: dir, encoding: "utf8" });
      for (const role of BLOCKS) assert.match(run.stdout, new RegExp(`node tools/checkpoint\\.mjs ${role}\\b`));
      assert.match(run.stdout, /Nothing was changed/);
      assert.deepEqual(await repoFiles(dir), before);
    });
  });
}

test("there is one checkpoint per block, each with a README that says what its block adds", async () => {
  const checkpointsDir = join(templateDir, "checkpoints");
  const folders = (await readdir(checkpointsDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.deepEqual(folders.sort(), [...BLOCKS].sort());
  for (const role of BLOCKS) assert.match(await readText(join(checkpointsDir, role, "README.md")), /block/, role);
});

test("a content file that is not valid JSON is kept; the command says how to fix it or go on with the sample person", async () => {
  await withRepo(OWN, async (dir) => {
    const broken = '{ "name": "Giulia Placeholder", ';
    await writeFile(join(dir, "site", "content.json"), broken);
    const run = jumpTo(dir, "lawyer");
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(await readText(join(dir, "site", "content.json")), broken);
    assert.match(run.stdout, /site\/content\.json is not valid JSON/);
    assert.match(run.stdout, /delete site\/content\.json and run this command again/);
    assert.deepEqual(lightDarkTokens(await readFile(join(dir, "site", "assets", "styles.css"), "utf8")), STITCH_COLOURS);
    // Doing what it says puts in the sample person, and the privacy page follows.
    await rm(join(dir, "site", "content.json"));
    assert.equal(jumpTo(dir, "lawyer").status, 0);
    for (const item of Object.values(await checkOf(dir))) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
    assert.ok((await readText(join(dir, "site", "privacy.html"))).includes("personal portfolio of Ada Example"));
  });
});

test("without an email address in the content file, the legal page keeps that blank and the command says why", async () => {
  await withRepo(async (dir) => {
    const content = JSON.parse(await readFile(join(dir, "site", "content.json"), "utf8"));
    content.links = content.links.filter((link) => !link.url.startsWith("mailto:"));
    await writeFile(join(dir, "site", "content.json"), JSON.stringify(content, null, 2));
    const { stdout } = jumpTo(dir, "lawyer");
    assert.ok((await readText(join(dir, "site", "privacy.html"))).includes("[[EMAIL]]"));
    assert.match(stdout, /no email address/);
    assert.match((await checkOf(dir)).legal.details.join("\n"), /\[\[EMAIL\]\]/);
  });
});

test("files the person added to the site, such as fonts or a photo, stay as they are", async () => {
  await withRepo(OWN, async (dir) => {
    const added = { "site/assets/fonts/OFL.txt": "SIL Open Font License", "site/assets/me.jpg": "not really a photo" };
    for (const [file, body] of Object.entries(added)) {
      await mkdir(dirname(join(dir, file)), { recursive: true });
      await writeFile(join(dir, file), body);
    }
    assert.equal(jumpTo(dir, "developer").status, 0);
    for (const [file, body] of Object.entries(added)) assert.equal(await readText(join(dir, file)), body, file);
  });
});

test("the command works on its own repo, from whichever folder it is run", async () => {
  await withRepo(async (dir) => {
    const run = spawnSync(process.execPath, [join(dir, "tools", "checkpoint.mjs"), "developer"], { cwd: tmpdir(), encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.deepEqual(lightDarkTokens(await readFile(join(dir, "site", "assets", "styles.css"), "utf8")), DEFAULT_COLOURS);
  });
});

const rgb = (hex) => `rgb(${[1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(", ")})`;

test("in Chrome, the caught-up site shows the person's own content in the colours and fonts of their brief", async () => {
  await withRepo(OWN, async (dir) => {
    assert.equal(jumpTo(dir, "lawyer").status, 0);
    const home = await inChrome(join(dir, "site"), `({
      name: document.querySelector("h1")?.textContent,
      headings: [...document.querySelectorAll("main > .section:not([hidden]) > h2")].map((h) => h.textContent.trim()),
      background: getComputedStyle(document.documentElement).backgroundColor,
      font: getComputedStyle(document.querySelector("h1")).fontFamily,
    })`);
    assert.equal(home.name, "Giulia Placeholder");
    assert.deepEqual(home.headings, ["Progetti", "Trovami", "CV"]);
    assert.ok([rgb(STITCH_COLOURS.background.Light), rgb(STITCH_COLOURS.background.Dark)].includes(home.background), home.background);
    assert.equal(home.font, STITCH_FONTS);
    const privacy = await inChrome(join(dir, "site"), `({
      text: document.querySelector("main").textContent,
      email: document.querySelector('a[href^="mailto:"]')?.getAttribute("href"),
    })`, "privacy.html");
    assert.match(privacy.text, /personal portfolio of Giulia Placeholder/);
    assert.equal(privacy.email, "mailto:giulia@example.com");
  });
});

// The commands in a Markdown text: its fenced blocks with no language, such as json.
const commandsIn = (markdown) =>
  [...markdown.matchAll(/^ *```(\w*)\n([\s\S]*?)^ *```$/gm)].filter((match) => !match[1]).map((match) => match[2].trim());

test("the README documents the one action, what it keeps, and where the checkpoints are", async () => {
  const readme = await readText(join(templateDir, "README.md"));
  assert.ok(commandsIn(readme).includes("node tools/checkpoint.mjs developer"));
  assert.match(readme, /keeps your own content file, design brief and spec/);
  assert.match(readme, /no Git/);
  assert.match(readme, /`checkpoints\/`/);
});

test("AGENTS.md sends a person who fell behind to the checkpoint skill, never to a role's work or to Git", async () => {
  const rules = await readText(join(templateDir, "AGENTS.md"));
  const section = rules.split(/^## /m).find((part) => /checkpoint/i.test(part.split("\n")[0]));
  assert.ok(section, "AGENTS.md has no section about checkpoints");
  assert.match(section, /skill `checkpoint`/);
  assert.ok(commandsIn(section).includes("node tools/checkpoint.mjs developer"));
  for (const needed of [/Never catch up by doing a role's work/, /never use Git/, /word for word/, /a chat of its own/, /do not start it/]) assert.match(section, needed);
});

const checkpointSkill = () => readText(join(templateDir, ".agents", "skills", "checkpoint", "SKILL.md"));

test("Antigravity finds the checkpoint skill, and its description matches a person who fell behind", async () => {
  const frontmatter = (await checkpointSkill()).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  assert.match(frontmatter, /^name: checkpoint$/m);
  const description = frontmatter.match(/^description: (.*)$/m)?.[1] ?? "";
  for (const needed of [/fell behind/, /catch up/, /checkpoint/, /node tools\/checkpoint\.mjs/, /ask them once/, /never guess/, /word for word/, /fresh chat/]) assert.match(description, needed);
});

test("the checkpoint skill runs the one command after at most one question, reads it back and hands over to a fresh chat", async () => {
  const skill = await checkpointSkill();
  assert.deepEqual(commandsIn(skill), ["node tools/checkpoint.mjs developer"]);
  for (const needed of [/Ask nothing/, /ask once/i, /use the one before it/, /word for word/, /add nothing to it/, /"You are back in step with the room\. Start a fresh chat and ask for QA\."/, /do not start it/]) {
    assert.match(skill, needed);
  }
  for (const needed of [/Never catch up by doing a role's work/, /never use Git/]) assert.match(skill, needed);
});

// Asked for a role in the chat that ran a checkpoint, the agent reads that
// role's skill, not AGENTS.md: so every role skill opens with the guard.
const ROLE_SKILLS = { analyst: "the Analyst", design: "the Designer", build: "the Developer", qa: "QA", legal: "the Lawyer", deploy: "Ops" };

for (const [skill, role] of Object.entries(ROLE_SKILLS)) {
  test(`the ${skill} skill starts only in a fresh chat, never after a checkpoint or another role`, async () => {
    const opening = (await readText(join(templateDir, ".agents", "skills", skill, "SKILL.md"))).split(/^## /m)[0];
    const guard = opening.split("\n").find((line) => line.includes("starts in a fresh chat")) ?? "";
    assert.match(guard, /checkpoint/);
    assert.match(guard, new RegExp(`ask for ${role} there`));
    assert.ok(opening.indexOf(guard) < opening.indexOf("You are"), "the guard comes first");
  });
}

test("when it writes the legal page, the command says, as the Lawyer does, that it is not legal advice", async () => {
  await withRepo(async (dir) => {
    const { stdout } = jumpTo(dir, "lawyer");
    assert.match(stdout, /not legal advice/);
    assert.match(stdout, /ask someone who knows the law in your country/);
    // Once the page is there, the second jump keeps it and says nothing more about it.
    assert.doesNotMatch(jumpTo(dir, "lawyer").stdout, /legal advice/);
  });
});

// Proxy runs: a fresh agent on Claude Haiku 4.5 caught up a person who had
// fallen behind, while the person's side came turn by turn from answers.md.
// before/ is what their repo held on top of the template, after/ every file
// that differed once the run was over, and report.md the chat and every tool
// call the agent made. See fixtures/README.md.
const runsDir = join(templateDir, "tests", "fixtures", "checkpoint-runs");
// askedAfter: the number of the person's message the checkpoint answered.
const RUNS = {
  developer: { next: "QA", askedAfter: 1 },
  lawyer: { next: "Ops", askedAfter: 2 },
};
const runReport = (run) => readText(join(runsDir, run, "report.md"));

// The agent's messages in answer to each of the person's messages, in order.
function answersTo(turns) {
  const answers = [];
  for (const turn of turns) {
    if (turn.who === "Person") answers.push([]);
    else answers.at(-1)?.push(turn.text);
  }
  return answers.map((texts) => texts.join("\n"));
}

// The repo at the end of a run, the template with before/ and after/ laid over it;
// or, with replay, the template with before/ and the one command run on it,
// with what the command said.
async function runRepo(run, { replay } = {}) {
  const repo = await participantRepo();
  await cp(join(runsDir, run, "before"), repo.dir, { recursive: true });
  if (replay) {
    const { status, stdout } = jumpTo(repo.dir, run);
    assert.equal(status, 0, stdout);
    return { ...repo, said: stdout };
  }
  if (existsSync(join(runsDir, run, "after"))) await cp(join(runsDir, run, "after"), repo.dir, { recursive: true });
  return repo;
}

// Text with every run of spaces, line breaks and Markdown emphasis made one space.
const flat = (text) => text.replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();

// The privacy page carries the day it was written.
const undated = (files) =>
  Object.fromEntries(
    Object.entries(files).map(([file, bytes]) => [file, file === "site/privacy.html" ? bytes.toString("utf8").replace(/Last updated: [^<]+/, "Last updated: DATE") : bytes]),
  );

for (const [run, { next, askedAfter }] of Object.entries(RUNS)) {
  test(`${run} run: the agent caught the person up with the one command, and wrote no file and ran no Git itself`, async () => {
    const calls = toolCallsIn(await runReport(run));
    assert.ok(calls?.length, "report.md lists no tool calls");
    const applied = calls.filter(({ call }) => /checkpoint\.mjs \w/.test(call)).map(({ call }) => call);
    assert.deepEqual(applied, [`Bash \`node tools/checkpoint.mjs ${run}\``]);
    for (const { call } of calls) {
      assert.doesNotMatch(call, /^(Edit|Write|NotebookEdit)\b/, call);
      assert.doesNotMatch(call, /\bgit\b/, call);
    }
  });

  test(`${run} run: what changed is exactly what the command changes, and the person's own files are untouched`, async () => {
    for (const file of ["site/content.json", "design/brief.md", "docs/spec.md"]) {
      assert.ok(!existsSync(join(runsDir, run, "after", file)), `${file} changed`);
    }
    const ended = await runRepo(run);
    const replayed = await runRepo(run, { replay: true });
    try {
      assert.deepEqual(undated(await repoFiles(ended.dir)), undated(await repoFiles(replayed.dir)));
    } finally {
      await ended.remove();
      await replayed.remove();
    }
  });

  test(`${run} run: the agent replied with the command's output word for word, up to what needs attention, then sent the person to a fresh chat for ${next}`, async () => {
    const readBack = flat(answersTo(turnsIn(await runReport(run), "Chat"))[askedAfter - 1]);
    const replayed = await runRepo(run, { replay: true });
    try {
      const shown = replayed.said.slice(0, replayed.said.indexOf("\nNext:")).split("\n").filter((line) => line.trim());
      for (const line of shown) assert.ok(readBack.includes(flat(line)), `missing from the read-back: ${line}`);
    } finally {
      await replayed.remove();
    }
    assert.match(readBack, new RegExp(`fresh chat and ask for ${next}`, "i"));
  });

  test(`${run} run: asked for ${next} in the same chat, the agent did not start it`, async () => {
    const report = await runReport(run);
    const answers = answersTo(turnsIn(report, "Chat"));
    const last = answers.length;
    assert.ok(last > askedAfter, "the person never asked for the next role");
    // It may read the role's skill, where it learns that the role starts in a fresh chat, but run nothing.
    for (const { call } of toolCallsIn(report).filter(({ after }) => after === last)) {
      assert.match(call, /^Read `(AGENTS\.md|\.agents\/skills\/[\w-]+\/SKILL\.md)`$/, call);
    }
    assert.match(answers.at(-1), /fresh chat/i);
  });
}

test("developer run: the person named the checkpoint, so the agent ran it at once", async () => {
  assert.equal(toolCallsIn(await runReport("developer")).find(({ call }) => /checkpoint\.mjs \w/.test(call)).after, 1);
});

test("lawyer run: the person did not say where the room is, so the agent asked once, then took the block before Ops", async () => {
  const report = await runReport("lawyer");
  assert.equal(toolCallsIn(report).find(({ call }) => /checkpoint\.mjs \w/.test(call)).after, 2);
  assert.match(answersTo(turnsIn(report, "Chat"))[0], /\?/);
});

test("a privacy page the Lawyer has written stays, even while the content file is not valid JSON", async () => {
  await withRepo(OWN, async (dir) => {
    const page = await giuliasPrivacyPage();
    await writeFile(join(dir, "site", "privacy.html"), page);
    await writeFile(join(dir, "site", "content.json"), '{ "name": "Giulia Placeholder", ');
    const { status, stdout } = jumpTo(dir, "lawyer");
    assert.equal(status, 0, stdout);
    assert.equal(await readText(join(dir, "site", "privacy.html")), page);
    assert.match(stdout, /not valid JSON/);
    assert.doesNotMatch(stdout, /no email address/);
  });
});

// The Stitch brief with the font cells of its Type table replaced.
async function briefWithFonts(dir, fonts) {
  const brief = await readFile(join(templateDir, OWN["design/brief.md"]), "utf8");
  await writeFile(join(dir, "design", "brief.md"), brief.replaceAll(`| ${STITCH_FONTS} |`, `| ${fonts} |`));
}

for (const [kind, written, stack] of [
  ["in backticks", `\`${STITCH_FONTS}\``, STITCH_FONTS],
  ["with a name in letters beyond English", '"Söhne", system-ui, sans-serif', '"Söhne", system-ui, sans-serif'],
]) {
  test(`a font stack ${kind} in the brief reaches the stylesheet`, async () => {
    await withRepo(OWN, async (dir) => {
      await briefWithFonts(dir, written);
      assert.equal(jumpTo(dir, "developer").status, 0);
      const css = await readFile(join(dir, "site", "assets", "styles.css"), "utf8");
      assert.ok(css.includes(`--font-heading: ${stack};`), css.match(/--font-heading:[^;]*;/)?.[0]);
      assert.ok(css.includes(`--font-body: ${stack};`), css.match(/--font-body:[^;]*;/)?.[0]);
    });
  });
}

test("a font list that is not one keeps the default fonts, and the command says so", async () => {
  await withRepo(OWN, async (dir) => {
    await briefWithFonts(dir, "system-ui; } body { display: none");
    const { stdout } = jumpTo(dir, "developer");
    const css = await readFile(join(dir, "site", "assets", "styles.css"), "utf8");
    assert.deepEqual(lightDarkTokens(css), STITCH_COLOURS);
    assert.ok(css.includes('--font-heading: "Newsreader", Georgia, "Times New Roman", serif;'));
    assert.doesNotMatch(css, /body \{ display: none/);
    assert.doesNotMatch(stdout, /colours and fonts of your design brief/);
    assert.match(stdout, /default fonts/);
  });
});

// What the site shows is the person's choice: the checkpoint takes nothing out
// and names nothing as private.
test("the Lawyer's checkpoint leaves the content file as it is, and its legal notice shows what the person gave", async () => {
  await withRepo({ "site/content.json": "tests/fixtures/clean-sites/contact-details-shown/content.json" }, async (dir) => {
    const given = await readText(join(dir, "site", "content.json"));
    const { stdout } = jumpTo(dir, "lawyer");
    assert.equal(await readText(join(dir, "site", "content.json")), given);
    assert.doesNotMatch(stdout, /private data/);
    assert.doesNotMatch(stdout, /postal address/, "an address is there, so nothing is missing");
    const page = await readText(join(dir, "site", "privacy.html"));
    for (const line of [
      "<p>Address: Via Esempio 1, 20100 Milano, Italy</p>",
      '<p>Phone: <a href="tel:+390000000000">+390000000000</a></p>',
      "<p>VAT number: IT00000000000</p>",
    ]) {
      assert.ok(page.includes(line), line);
    }
    for (const item of Object.values(await checkOf(dir))) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
  });
});

test("without an address, the Lawyer's checkpoint leaves the legal notice's optional lines out and says what a site that offers services still needs", async () => {
  await withRepo(async (dir) => {
    const { stdout } = jumpTo(dir, "lawyer");
    const page = await readText(join(dir, "site", "privacy.html"));
    assert.doesNotMatch(page, /Address:|Phone:|VAT number:|\[\[/);
    assert.match(stdout, /If your site offers services, the law also asks for a postal address, and in Italy for your Partita IVA/);
  });
});

test("every file the command changed comes with what it is", async () => {
  await withRepo(OWN, async (dir) => {
    for (const file of ["index.html", "assets/main.js", "assets/render.js", "assets/styles.css", "assets/favicon.svg", "content.schema.json"]) {
      await writeFile(join(dir, "site", file), "broken");
    }
    await rm(join(dir, "site", "privacy.html"));
    await writeFile(join(dir, "design", "default-brief.md"), "broken");
    const { stdout } = jumpTo(dir, "developer");
    const changed = stdout.slice(stdout.indexOf("Changed"), stdout.indexOf("\n\n", stdout.indexOf("Changed"))).split("\n").slice(1);
    assert.equal(changed.length, 8, changed.join("\n"));
    for (const line of changed) assert.match(line, /^ {2}\S+ – \S/, line);
  });
});

test("the Lawyer's checkpoint holds the Lawyer's own privacy template, blanks and all", async () => {
  assert.equal(
    await readText(join(templateDir, "checkpoints", "lawyer", "site", "privacy.html")),
    await readText(join(templateDir, ".agents", "skills", "legal", "privacy-template.html")),
  );
});
