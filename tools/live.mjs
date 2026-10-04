// Is my site live? Run it from your repo folder after a push:
//
//   node tools/live.mjs
//
// It works out your site's address on GitHub Pages from your repo's GitHub
// address, then waits until the site online shows what you pushed: every
// file in site/ online is the same as in your last commit. It says plainly
// what is going on, and what to do if the site does not show up.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoDir = fileURLToPath(new URL("..", import.meta.url));

const git = (...args) => spawnSync("git", args, { cwd: repoDir, encoding: "buffer" });
const gitText = (...args) => {
  const result = git(...args);
  return result.status === 0 ? result.stdout.toString("utf8").trim() : null;
};

// https://github.com/Owner/repo.git or git@github.com:Owner/repo.git
function githubRepo(remote) {
  const match = remote.match(/^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return match && { owner: match[1], name: match[2] };
}

// A repo named like username.github.io is the site at the root address;
// any other repo is a folder under it.
function pagesAddress({ owner, name }) {
  const host = `${owner.toLowerCase()}.github.io`;
  return name.toLowerCase() === host ? `https://${host}/` : `https://${host}/${name}/`;
}

// Why the last commit cannot be online yet, or null when it is on GitHub.
function notPushedYet() {
  const status = gitText("status", "--porcelain=v2", "--branch") ?? "";
  const branch = status.match(/^# branch\.head (.+)$/m)?.[1];
  if (branch !== "main") {
    return `You are on the branch "${branch}". Only the branch main is published. Ask your agent to switch back to main.`;
  }
  if (!/^# branch\.upstream /m.test(status)) {
    return "Your commits are not on GitHub yet. Push them first: git push -u origin main";
  }
  const ahead = Number(status.match(/^# branch\.ab \+(\d+)/m)?.[1] ?? 0);
  if (ahead > 0) {
    return `You have ${ahead} commit${ahead === 1 ? "" : "s"} that ${ahead === 1 ? "is" : "are"} not on GitHub yet. Push first: git push`;
  }
  return null;
}

// Files in site/ changed since the last commit: the site online will not have them.
function uncommitted() {
  // Each line is two status letters, a space and the path, so no trimming.
  const lines = git("status", "--porcelain", "--", "site").stdout.toString("utf8").split("\n").filter(Boolean);
  return lines.map((line) => line.slice(3));
}

// What the online site serves for one path, or null when it is not there.
async function fetchOnline(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}?live-check=${Date.now()}`, { cache: "no-store" });
  return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
}

// "live" when every file in site/ of the last commit is online unchanged,
// "missing" when there is no home page online at all.
async function onlineState(baseUrl, files) {
  // The home page first: without it, nothing of the site is online.
  const ordered = ["site/index.html", ...files.filter((path) => path !== "site/index.html")];
  try {
    for (const path of ordered) {
      const online = await fetchOnline(baseUrl, path.slice("site/".length));
      if (!online) return path === "site/index.html" ? "missing" : "older";
      if (!online.equals(git("show", `HEAD:${path}`).stdout)) return "older";
    }
    return "live";
  } catch {
    return "unreachable";
  }
}

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

const WHILE_WAITING = {
  missing: "Not online yet.",
  older: "An older version is online; the new one is on its way.",
  unreachable: "Could not reach your site.",
};

// What to do when the site did not show up in time, by what is online.
function giveUp(state, { owner, name }, address) {
  const repoPage = `https://github.com/${owner}/${name}`;
  if (state === "unreachable") {
    return `Could not reach ${address}. Check that your computer is online, then run node tools/live.mjs again.`;
  }
  if (state === "missing") {
    return [
      "Your site is not online yet. Most likely GitHub Pages is not switched on for this repo. That is needed once:",
      `  1. Open ${repoPage}/settings/pages in Chrome.`,
      '  2. Under "Build and deployment", set Source to "GitHub Actions".',
      "  3. Publish again: push a new commit (your agent can do that), or re-run the latest",
      `     "Deploy to GitHub Pages" run on ${repoPage}/actions.`,
      "Then run node tools/live.mjs again. If Pages is already set to GitHub Actions, wait a minute and run it again.",
    ].join("\n");
  }
  return [
    "An older version of your site is still online. Publishing usually takes about a minute.",
    `Open ${repoPage}/actions to watch it: the newest "Deploy to GitHub Pages" run should get a green tick.`,
    "If it shows a red cross, click it to see what went wrong. Then run node tools/live.mjs again.",
  ].join("\n");
}

async function main() {
  if (git("--version").error) {
    console.log("Git is not installed, so this cannot see your repo. Run the Install script again: it installs Git.");
    return;
  }
  const remote = gitText("config", "--get", "remote.origin.url");
  const repo = remote && githubRepo(remote);
  if (!repo) {
    console.log(
      remote
        ? `This repo is not connected to a repo on GitHub: its remote is ${remote}. GitHub Pages only publishes repos on GitHub.`
        : "This repo is not connected to a repo on GitHub yet, so it cannot be published. Ask the instructor for help.",
    );
    return;
  }
  const address = pagesAddress(repo);
  console.log(`Your site's address: ${address}`);

  const blocker = notPushedYet();
  if (blocker) {
    console.log(blocker);
    return;
  }
  const changed = uncommitted();
  if (changed.length > 0) {
    console.log(`These changes are not committed yet, so they will not be online: ${changed.join(", ")}`);
  }

  const files = gitText("ls-tree", "-r", "--name-only", "HEAD", "--", "site").split("\n").filter(Boolean);
  const baseUrl = process.env.PORTFOLIO_LIVE_URL || address;
  const wait = Number(process.env.PORTFOLIO_LIVE_WAIT || 180);
  const started = Date.now();
  for (;;) {
    const state = await onlineState(baseUrl, files);
    if (state === "live") {
      console.log(`Your site is live. Open ${address} in Chrome and share the link.`);
      return;
    }
    if ((Date.now() - started) / 1000 >= wait) {
      console.log(giveUp(state, repo, address));
      return;
    }
    const pause = Math.min(10, wait / 5);
    console.log(`${WHILE_WAITING[state]} Looking again in ${Math.round(pause)} seconds…`);
    await sleep(pause);
  }
}

await main();
// Always 0: this reports, it never gates.
process.exitCode = 0;
