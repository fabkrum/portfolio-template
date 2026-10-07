// Where is the person in the workshop? Says, Role by Role, what is done,
// judged from the files each Role writes, and which Role comes next. It
// compares the repo with the template as it ships, as a checkpoint does, and
// changes nothing. What it says about GitHub is what Git knows on this
// computer: it asks no server.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkBrief } from "../brief/check-brief.mjs";
import { findPrivateDataInContent, findPrivateDataInSiteFiles } from "../check/private-data.mjs";
import { isPlaceholderPage, privacyPageProblems } from "../check/run-check.mjs";
import { validateContent } from "../check/schema.mjs";
import { BLOCKS, nonEmpty, readContent, sourcesUpTo, writtenFor } from "../checkpoint/apply-checkpoint.mjs";

const done = (note) => ({ state: "done", note });
const toFix = (note) => ({ state: "to fix", note });
const notYet = (note) => ({ state: "not yet", note });

const counted = (count, thing) => `${count} ${thing}${count === 1 ? "" : "s"}`;

async function schemaProblems(repoDir, content) {
  try {
    return validateContent(JSON.parse(await readFile(join(repoDir, "site", "content.schema.json"), "utf8")), content);
  } catch {
    return []; // Without a schema there is nothing to check against; the Check names that.
  }
}

// The Analyst writes the content file and the spec.
async function analyst({ repoDir, has, asShipped, content, unreadable }) {
  if (!has("site/content.json")) return notYet("there is no site/content.json yet.");
  if (await asShipped("site/content.json")) return notYet(`site/content.json is still the sample person, ${content.name}.`);
  if (unreadable) return toFix("site/content.json is not valid JSON. node tools/check-content.mjs shows where.");
  const problems = await schemaProblems(repoDir, content);
  if (problems.length > 0) return toFix(`site/content.json has ${counted(problems.length, "thing")} to fix. node tools/check-content.mjs lists them.`);
  const forWhom = nonEmpty(content.name) ? `, for ${content.name}` : "";
  if (!has("docs/spec.md")) return done(`your content file${forWhom}. There is no docs/spec.md yet.`);
  if (await asShipped("docs/spec.md")) return done(`your content file${forWhom}. docs/spec.md is still the sample spec.`);
  return done(`your content file and spec${forWhom}.`);
}

// The Designer writes the design brief, or keeps the default one.
async function designer({ repoDir, has, asShipped }) {
  if (!has("design/brief.md")) return notYet("there is no design/brief.md yet.");
  if (await asShipped("design/brief.md")) return { ...notYet("design/brief.md is still the default design."), defaultBrief: true };
  const problems = checkBrief(await readFile(join(repoDir, "design", "brief.md"), "utf8"));
  return problems.length > 0
    ? toFix(`design/brief.md has ${counted(problems.length, "thing")} to fix. node tools/check-brief.mjs lists them.`)
    : done("your design brief.");
}

// The Developer replaces the template's plain stylesheet.
async function developer({ has, asShipped }) {
  if (!has("site/assets/styles.css")) return notYet("there is no site/assets/styles.css.");
  if (await asShipped("site/assets/styles.css")) return notYet("site/assets/styles.css is still the plain stylesheet of the template.");
  return done("the Developer's stylesheet, in site/assets/styles.css.");
}

// QA looks at the site with node tools/look.mjs, which saves screenshots in qa/.
async function qa({ repoDir }) {
  let files = [];
  try {
    files = await readdir(join(repoDir, "qa"));
  } catch {}
  return files.some((file) => file.endsWith(".png"))
    ? done("screenshots of your site in qa/.")
    : notYet("no screenshots in qa/ yet. QA takes them with node tools/look.mjs.");
}

// The Lawyer writes the privacy page for the person and takes private data out.
async function lawyer({ repoDir, has, content, unreadable }) {
  if (!has("site/privacy.html")) return notYet("there is no site/privacy.html.");
  const page = await readFile(join(repoDir, "site", "privacy.html"), "utf8");
  if (isPlaceholderPage(page)) return notYet("site/privacy.html is still the placeholder.");
  const [problem] = privacyPageProblems(page);
  if (problem) return toFix(`site/${problem}`);
  const name = nonEmpty(content.name);
  if (!writtenFor(page, { name, unreadable })) {
    return toFix(`site/privacy.html does not name ${name ?? "the person in site/content.json"}. The Lawyer writes it again.`);
  }
  const privateData = [
    ...(unreadable ? [] : findPrivateDataInContent(content)),
    ...(await findPrivateDataInSiteFiles(join(repoDir, "site"))),
  ];
  if (privateData.length > 0) {
    const more = privateData.length > 1 ? ` And ${privateData.length - 1} more: node tools/check.mjs lists them.` : "";
    return toFix(`what looks like private data is still in the site: ${privateData[0]}${more}`);
  }
  return done(`your privacy page${name ? `, for ${name}` : ""}.`);
}

// Ops publishes by pushing to the branch main on GitHub. Git's own view of
// this computer only: whether there is a remote, what is not committed, and
// which commits are not pushed. GIT_OPTIONAL_LOCKS=0 keeps git status from
// writing to the repo while it looks.
function ops(repoDir, lawyerDone) {
  const git = (...args) =>
    spawnSync("git", args, { cwd: repoDir, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  // On a fresh Mac, git is a stub that fails until the developer tools are installed.
  const version = git("--version");
  if (version.error || version.status !== 0) return notYet("Git is not installed. Running the Install script again installs it.");
  if (!existsSync(join(repoDir, ".git"))) return notYet("this folder is not connected to Git yet. Running the Install script again connects it.");
  if (git("config", "--get", "remote.origin.url").status !== 0) return notYet("this repo is not connected to GitHub. Ask the instructor for help.");
  const status = git("status", "--porcelain=v2", "--branch", "--untracked-files=all");
  if (status.status !== 0) return notYet(`Git could not read this repo: ${status.stderr.trim().split("\n")[0]}`);
  const lines = status.stdout.split(/\r?\n/);
  const header = (key) => lines.find((line) => line.startsWith(`# branch.${key} `))?.slice(`# branch.${key} `.length);
  const branch = header("head");
  const changed = lines.filter((line) => line && !line.startsWith("#")).length;
  const ahead = Number(header("ab")?.match(/^\+(\d+)/)?.[1] ?? 0);
  if (branch !== "main") return notYet(`you are on the branch "${branch}", but only the branch main is published.`);
  if (changed > 0) return notYet(`${counted(changed, "changed file")} ${changed === 1 ? "is" : "are"} not on GitHub yet.`);
  if (!header("upstream")) return notYet("your commits are not on GitHub yet.");
  if (ahead > 0) return notYet(`${counted(ahead, "commit")} ${ahead === 1 ? "is" : "are"} not on GitHub yet.`);
  return lawyerDone ? done("everything is on GitHub.") : notYet("everything so far is on GitHub.");
}

// Every Role as { block, state, note }, state "done", "to fix" or "not yet",
// and the block of the Role that comes next: the first Role whose work needs
// a fix, or else the Role after the last one done. A Role before that which
// is not done was skipped with a checkpoint; the room has moved on. Null once
// Ops is done.
export async function whereAmI(repoDir) {
  // The template as it ships, which is the Analyst's checkpoint: the sample
  // person, the sample spec, the default brief, the plain stylesheet and the
  // placeholder privacy page.
  const shipped = await sourcesUpTo(repoDir, "analyst");
  const has = (file) => existsSync(join(repoDir, file));
  const asShipped = async (file) => has(file) && (await readFile(join(repoDir, file))).equals(await readFile(shipped.get(file)));
  const repo = { repoDir, has, asShipped, ...(await readContent(join(repoDir, "site", "content.json"))) };

  const states = [await analyst(repo), await designer(repo), await developer(repo), await qa(repo), await lawyer(repo)];
  states.push(ops(repoDir, states[4].state === "done"));
  // Once a later Role is done, the default brief was the design: saying
  // "default" is how the Designer keeps it.
  if (states[1].defaultBrief && states.slice(2).some(({ state }) => state === "done")) states[1] = done("the default design.");

  const roles = BLOCKS.map((block, index) => ({ block, ...states[index] }));
  const fix = roles.findIndex(({ state }) => state === "to fix");
  const next = fix >= 0 ? fix : roles.findLastIndex(({ state }) => state === "done") + 1;
  return { roles, next: BLOCKS[next] ?? null };
}
