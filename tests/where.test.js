import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { templateDir, withRepo } from "./participant-repo.js";

// The one command, run the way the help skill runs it: from the repo folder.
const whereIn = (dir, cwd = dir) => spawnSync(process.execPath, [join(dir, "tools", "where.mjs")], { cwd, encoding: "utf8" });
const jumpTo = (dir, block) => spawnSync(process.execPath, [join(dir, "tools", "checkpoint.mjs"), block], { cwd: dir, encoding: "utf8" });

// No background maintenance: Git may pack a repo's objects after a commit
// while a test still reads or deletes them.
const QUIET_GIT = ["-c", "user.name=Ada Example", "-c", "user.email=ada@example.com", "-c", "gc.auto=0", "-c", "maintenance.auto=false"];

const git = (cwd, ...args) => {
  const result = spawnSync("git", [...QUIET_GIT, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};

// Runs use(dir) on a participant's repo as the Install script's clone leaves
// it: the template in one commit on main, pushed to its origin. The origin is
// a GitHub address that Git quietly sends to a bare repo on disk, so a push
// works without GitHub.
async function withClone(use) {
  const github = await mkdtemp(join(tmpdir(), "github-"));
  try {
    return await withRepo(async (dir) => {
      const origin = "https://github.com/Ada-Example/portfolio.git";
      git(github, "init", "-q", "--bare");
      git(dir, "init", "-q", "-b", "main");
      git(dir, "add", "-A");
      git(dir, "commit", "-q", "-m", "Initial commit");
      git(dir, "config", `url.${pathToFileURL(github).href}.insteadOf`, origin);
      git(dir, "remote", "add", "origin", origin);
      git(dir, "push", "-q", "-u", "origin", "main");
      return await use(dir);
    });
  } finally {
    await rm(github, { recursive: true, force: true });
  }
}

// Lays files of the person's own over their repo: { "site/content.json": "tests/fixtures/…" }.
async function lay(dir, own) {
  for (const [file, from] of Object.entries(own)) await cp(join(templateDir, from), join(dir, file));
}

// The privacy page the Lawyer writes for Giulia Placeholder, the person of the Analyst's CV run.
const giuliasPrivacyPage = async () =>
  (await readFile(join(templateDir, "tests", "fixtures", "finished-privacy", "privacy.html"), "utf8"))
    .replaceAll("Ada Example", "Giulia Placeholder")
    .replaceAll("ada@example.com", "giulia@example.com");

// What each Role leaves in the person's repo, in the order of the day: the
// content file and spec of the Analyst's CV run, the brief the Designer wrote
// from Stitch's HTML, the stylesheet the Developer built from it, QA's
// screenshots, the Lawyer's privacy page and Ops' push.
const LEAVES = {
  Analyst: (dir) => lay(dir, { "site/content.json": "tests/fixtures/analyst-runs/cv/site/content.json", "docs/spec.md": "tests/fixtures/analyst-runs/cv/spec.md" }),
  Designer: (dir) => lay(dir, { "design/brief.md": "tests/fixtures/design/briefs/from-stitch-html.md" }),
  Developer: (dir) => lay(dir, { "site/assets/styles.css": "tests/fixtures/built-sites/stitch-web-font/assets/styles.css" }),
  QA: async (dir) => {
    await mkdir(join(dir, "qa"));
    await writeFile(join(dir, "qa", "index-phone-light.png"), "a screenshot");
  },
  Lawyer: async (dir) => writeFile(join(dir, "site", "privacy.html"), await giuliasPrivacyPage()),
  Ops: (dir) => {
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Publish my portfolio");
    git(dir, "push", "-q");
  },
};
const ROLES = Object.keys(LEAVES);
const CALLED = { Analyst: "the Analyst", Designer: "the Designer", Developer: "the Developer", QA: "QA", Lawyer: "the Lawyer", Ops: "Ops" };

// What the command says about Ops at each point of the day: the files not
// committed yet (QA's screenshots are not among them: qa/ stays on the laptop).
const OPS_NOTES = [
  "everything so far is on GitHub.",
  "2 changed files are not on GitHub yet.",
  "3 changed files are not on GitHub yet.",
  "4 changed files are not on GitHub yet.",
  "4 changed files are not on GitHub yet.",
  "5 changed files are not on GitHub yet.",
  "everything is on GitHub.",
];

// The line of one Role, as { state: "done" | "to fix" | "not yet", note }.
function roleLine(stdout, role) {
  const match = stdout.match(new RegExp(`^  (done|to fix|not yet) +${role} – (.+)$`, "m"));
  assert.ok(match, `no line for ${role} in:\n${stdout}`);
  return { state: match[1], note: match[2] };
}
const statesIn = (stdout) => Object.fromEntries(ROLES.map((role) => [role, roleLine(stdout, role).state]));
// What the command says after the Roles, from "Next:" on.
const nextLines = (stdout) => stdout.slice(stdout.indexOf("Next:")).trim().split("\n");
const CATCH_UP = "Behind the room? Type: Catch me up: the room just finished the <Role> block.";

for (let finished = 0; finished <= ROLES.length; finished++) {
  const role = ROLES[finished];
  const name =
    finished === 0
      ? "a fresh copy: no Role is done yet, and the Analyst is next, with the sentence that starts it"
      : role
        ? `after ${CALLED[ROLES[finished - 1]]}: ${finished} of 6 Roles done, and ${CALLED[role]} is next, on guide page ${finished + 2}`
        : "after Ops: all six Roles are done, everything is on GitHub, and the guide's feedback page is next";
  test(name, async () => {
    await withClone(async (dir) => {
      for (const done of ROLES.slice(0, finished)) await LEAVES[done](dir);
      const { status, stdout } = whereIn(dir);
      assert.equal(status, 0, stdout);
      assert.deepEqual(statesIn(stdout), Object.fromEntries(ROLES.map((each, index) => [each, index < finished ? "done" : "not yet"])));
      assert.equal(roleLine(stdout, "Ops").note, OPS_NOTES[finished]);
      if (!role) {
        assert.deepEqual(nextLines(stdout), [
          "Next: Guide page 8: Feedback.",
          "To see whether your site is live, run node tools/live.mjs.",
          "To add a section to your site, start a fresh chat and type: Add a YouTube section to my portfolio.",
        ]);
        return;
      }
      // The default brief may be the Designer's own choice: saying "default" keeps it as it is.
      const orDefault = role === "Designer" ? ["Already said default to the Designer? Then the Developer is next: Start the Developer step."] : [];
      assert.deepEqual(nextLines(stdout), [
        `Next: ${CALLED[role]}. Guide page ${finished + 2}: ${role}.`,
        `Start a fresh chat and type: Start the ${role} step.`,
        ...orDefault,
        CATCH_UP,
      ]);
    });
  });
}

test("a fresh copy still holds the sample person; after the Analyst, the person's own name is there", async () => {
  await withClone(async (dir) => {
    assert.equal(roleLine(whereIn(dir).stdout, "Analyst").note, "site/content.json is still the sample person, Ada Example.");
    await LEAVES.Analyst(dir);
    assert.equal(roleLine(whereIn(dir).stdout, "Analyst").note, "your content file and spec, for Giulia Placeholder.");
  });
});

test("said default to the Designer, then built: the default design counts, and QA is next", async () => {
  await withClone(async (dir) => {
    await LEAVES.Analyst(dir);
    await LEAVES.Developer(dir);
    const { stdout } = whereIn(dir);
    assert.deepEqual(roleLine(stdout, "Designer"), { state: "done", note: "the default design." });
    assert.match(stdout, /^Next: QA\. Guide page 5: QA\.$/m);
  });
});

test("caught up with the Lawyer's checkpoint, with no content of their own: Ops is next, and the Analyst is still to do", async () => {
  await withClone(async (dir) => {
    assert.equal(jumpTo(dir, "lawyer").status, 0);
    const { stdout } = whereIn(dir);
    assert.deepEqual(statesIn(stdout), { Analyst: "not yet", Designer: "done", Developer: "done", QA: "not yet", Lawyer: "done", Ops: "not yet" });
    assert.match(stdout, /^Next: Ops\. Guide page 7: Ops\.$/m);
  });
});

test("a content file that is not valid JSON comes first, even after the Developer's checkpoint", async () => {
  await withClone(async (dir) => {
    await LEAVES.Analyst(dir);
    assert.equal(jumpTo(dir, "developer").status, 0);
    await writeFile(join(dir, "site", "content.json"), '{ "name": "Giulia Placeholder", ');
    const { stdout } = whereIn(dir);
    assert.deepEqual(roleLine(stdout, "Analyst"), { state: "to fix", note: "site/content.json is not valid JSON. node tools/check-content.mjs shows where." });
    assert.equal(roleLine(stdout, "Developer").state, "done");
    assert.match(stdout, /^Next: the Analyst\. Guide page 2: Analyst\.$/m);
  });
});

test("private data left in the content file sends the person back to the Lawyer before Ops", async () => {
  await withClone(async (dir) => {
    await lay(dir, { "site/content.json": "tests/fixtures/lawyer-runs/before/content.json" });
    assert.equal(jumpTo(dir, "lawyer").status, 0);
    const { stdout } = whereIn(dir);
    const lawyer = roleLine(stdout, "Lawyer");
    assert.equal(lawyer.state, "to fix");
    assert.match(lawyer.note, /"\+00 000 000 0000" looks like a phone number/);
    assert.match(stdout, /^Next: the Lawyer\. Guide page 6: Lawyer\.$/m);
  });
});

test("a commit that is not pushed yet is named, and Ops is next", async () => {
  await withClone(async (dir) => {
    for (const role of ROLES.slice(0, 5)) await LEAVES[role](dir);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "Publish my portfolio");
    const { stdout } = whereIn(dir);
    assert.deepEqual(roleLine(stdout, "Ops"), { state: "not yet", note: "1 commit is not on GitHub yet." });
    assert.match(stdout, /^Next: Ops\. Guide page 7: Ops\.$/m);
  });
});

test("without Git, as after the Install script's download, or without a remote, Ops says what is missing", async () => {
  await withRepo(async (dir) => {
    const { status, stdout } = whereIn(dir);
    assert.equal(status, 0, stdout);
    assert.match(roleLine(stdout, "Ops").note, /not connected to Git yet\. Running the Install script again connects it/);
    git(dir, "init", "-q", "-b", "main");
    assert.match(roleLine(whereIn(dir).stdout, "Ops").note, /not connected to GitHub/);
  });
});

// Every file of a repo, Git's own files too, as { "site/index.html": <bytes>, … }.
async function filesIn(dir) {
  const files = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) files[relative(dir, join(entry.parentPath, entry.name))] = await readFile(join(entry.parentPath, entry.name));
  }
  return files;
}

test("the command changes no file, not even Git's index", async () => {
  await withClone(async (dir) => {
    await LEAVES.Analyst(dir);
    // A file saved again unchanged: a plain git status would write its new time into Git's index.
    const page = join(dir, "site", "index.html");
    await writeFile(page, await readFile(page));
    const before = await filesIn(dir);
    assert.equal(whereIn(dir).status, 0);
    assert.deepEqual(await filesIn(dir), before);
  });
});

test("the command works on its own repo, from whichever folder it is run", async () => {
  await withRepo(async (dir) => {
    const { status, stdout } = whereIn(dir, tmpdir());
    assert.equal(status, 0, stdout);
    assert.match(stdout, /^Next: the Analyst\. Guide page 2: Analyst\.$/m);
  });
});

test("the command asks no server: it runs only Git commands that read this computer", async () => {
  const source = await readFile(join(templateDir, "tools", "where", "where-am-i.mjs"), "utf8");
  const commands = [...source.matchAll(/\bgit\("([^"]+)"/g)].map(([, command]) => command);
  assert.deepEqual([...new Set(commands)].sort(), ["--version", "config", "status"]);
  assert.doesNotMatch(source, /\bfetch\(/);
});
