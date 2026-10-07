import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSite } from "../tools/build/build-site.mjs";
import { serveSite } from "../tools/check/serve-site.mjs";
import { sampleSite } from "./fixture-site.js";

const toolsDir = fileURLToPath(new URL("../tools", import.meta.url));

// No background maintenance: Git may pack a repo's objects after a commit
// while a test still reads or deletes them.
const QUIET_GIT = ["-c", "user.name=Ada Example", "-c", "user.email=ada@example.com", "-c", "gc.auto=0", "-c", "maintenance.auto=false"];

const git = (cwd, ...args) => {
  const result = spawnSync("git", [...QUIET_GIT, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

// A participant's repo: the sample site committed, its origin a GitHub
// address that Git quietly sends to a bare repo on disk, so a push works
// without GitHub. Pass origin: null for a repo with no remote.
async function participantRepo({ origin = "https://github.com/Ada-Example/portfolio.git", push = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "live-"));
  const repo = join(dir, "portfolio");
  await cp(sampleSite, join(repo, "site"), { recursive: true });
  await cp(toolsDir, join(repo, "tools"), { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "My portfolio");
  if (origin) {
    const bare = join(dir, "github.git");
    git(dir, "init", "-q", "--bare", bare);
    git(repo, "config", `url.${pathToFileURL(bare).href}.insteadOf`, origin);
    git(repo, "remote", "add", "origin", origin);
    if (push) git(repo, "push", "-q", "-u", "origin", "main");
  }
  return { repo, remove: () => rm(dir, { recursive: true, force: true }) };
}

// Runs node tools/live.mjs in the repo, with "online" served from this folder
// in place of GitHub Pages, waiting at most this many seconds.
function runLive(repo, { online, wait = 2 } = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, ["tools/live.mjs"], {
      cwd: repo,
      env: { ...process.env, PORTFOLIO_LIVE_URL: online ?? "", PORTFOLIO_LIVE_WAIT: String(wait) },
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("close", (status) => done({ stdout, status }));
  });
}

// Serves the site as publishing on GitHub leaves it, changed by "change":
// site/ of the repo's last commit, built, with that commit in version.txt.
// Like GitHub, it builds what was committed: on Windows the files on disk may
// have CRLF line endings where the commit has LF.
async function onlineSite(repo, change = async () => {}) {
  const dir = await mkdtemp(join(tmpdir(), "online-"));
  const committed = join(dir, "site");
  for (const path of git(repo, "ls-tree", "-r", "-z", "--name-only", "HEAD", "--", "site").split("\0").filter(Boolean)) {
    const target = join(committed, path.slice("site/".length));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, spawnSync("git", ["show", `HEAD:${path}`], { cwd: repo }).stdout);
  }
  const online = join(dir, "online");
  await buildSite(committed, online, { address: "https://ada-example.github.io/portfolio/", commit: git(repo, "rev-parse", "HEAD") });
  await change(online);
  const server = await serveSite(online);
  return { url: `${server.origin}/`, close: async () => (server.close(), rm(dir, { recursive: true, force: true })) };
}

test("after a push, it names the site's address and says it is live once the online site matches", async () => {
  const { repo, remove } = await participantRepo();
  const online = await onlineSite(repo);
  try {
    const { stdout, status } = await runLive(repo, { online: online.url });
    assert.equal(status, 0);
    assert.match(stdout, /https:\/\/ada-example\.github\.io\/portfolio\//);
    assert.match(stdout, /is live/);
  } finally {
    await online.close();
    await remove();
  }
});

test("a site that never shows up gets the one-time Pages setting explained, step by step", async () => {
  const { repo, remove } = await participantRepo();
  // GitHub Pages switched off: every address answers 404.
  const online = await onlineSite(repo, async (dir) => {
    await rm(dir, { recursive: true });
    await mkdir(dir);
  });
  try {
    const { stdout, status } = await runLive(repo, { online: online.url });
    assert.equal(status, 0);
    assert.doesNotMatch(stdout, /is live/);
    assert.match(stdout, /https:\/\/github\.com\/Ada-Example\/portfolio\/settings\/pages/);
    assert.match(stdout, /Source/);
    assert.match(stdout, /GitHub Actions/);
  } finally {
    await online.close();
    await remove();
  }
});

test("while an older version is online, it says the new one is on its way and where to watch it", async () => {
  const { repo, remove } = await participantRepo();
  const online = await onlineSite(repo);
  try {
    // A new commit, pushed, that GitHub has not published yet.
    const path = join(repo, "site", "content.json");
    await writeFile(path, (await readFile(path, "utf8")).replace("Frontend developer", "Web developer"));
    git(repo, "commit", "-q", "-am", "A new headline");
    git(repo, "push", "-q");
    const { stdout } = await runLive(repo, { online: online.url });
    assert.doesNotMatch(stdout, /is live/);
    assert.match(stdout, /older version/);
    assert.match(stdout, /https:\/\/github\.com\/Ada-Example\/portfolio\/actions/);
  } finally {
    await online.close();
    await remove();
  }
});

test("a site online from before the build wrote version.txt counts as an older version", async () => {
  const { repo, remove } = await participantRepo();
  const online = await onlineSite(repo, (dir) => rm(join(dir, "version.txt")));
  try {
    const { stdout } = await runLive(repo, { online: online.url });
    assert.doesNotMatch(stdout, /is live/);
    assert.match(stdout, /older version/);
  } finally {
    await online.close();
    await remove();
  }
});

test("with a CNAME file in site/, the address is the site's own domain", async () => {
  const { repo, remove } = await participantRepo();
  await writeFile(join(repo, "site", "CNAME"), "www.ada-example.dev\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "My own domain");
  git(repo, "push", "-q");
  const online = await onlineSite(repo);
  try {
    const { stdout } = await runLive(repo, { online: online.url });
    assert.match(stdout, /Your site's address: https:\/\/www\.ada-example\.dev\/\n/);
    assert.match(stdout, /is live/);
  } finally {
    await online.close();
    await remove();
  }
});

test("a repo named username.github.io over SSH is the site at the root address", async () => {
  const { repo, remove } = await participantRepo({ origin: "git@github.com:Ada-Example/Ada-Example.github.io.git" });
  const online = await onlineSite(repo);
  try {
    const { stdout } = await runLive(repo, { online: online.url });
    assert.match(stdout, /Your site's address: https:\/\/ada-example\.github\.io\/\n/);
    assert.match(stdout, /is live/);
  } finally {
    await online.close();
    await remove();
  }
});

test("a repo with no GitHub remote is told so in plain words, without a crash", async () => {
  const { repo, remove } = await participantRepo({ origin: null });
  try {
    const { stdout, status } = await runLive(repo);
    assert.equal(status, 0);
    assert.match(stdout, /not connected to a repo on GitHub/);
  } finally {
    await remove();
  }
});

test("a remote that is not on GitHub is named: GitHub Pages needs GitHub", async () => {
  const { repo, remove } = await participantRepo({ origin: "https://gitlab.com/ada/portfolio.git" });
  try {
    const { stdout } = await runLive(repo);
    assert.match(stdout, /https:\/\/gitlab\.com\/ada\/portfolio\.git/);
    assert.match(stdout, /not connected to a repo on GitHub/);
  } finally {
    await remove();
  }
});

test("commits that are not pushed yet are named before any waiting", async () => {
  const { repo, remove } = await participantRepo();
  try {
    await writeFile(join(repo, "site", "content.json"), "{}\n");
    git(repo, "commit", "-q", "-am", "Change");
    const { stdout } = await runLive(repo, { online: "http://127.0.0.1:9/" });
    assert.match(stdout, /1 commit that is not on GitHub yet/);
    assert.match(stdout, /git push/);
  } finally {
    await remove();
  }
});

test("changes in site/ that are not committed yet are named: they will not be online", async () => {
  const { repo, remove } = await participantRepo();
  const online = await onlineSite(repo);
  try {
    await writeFile(join(repo, "site", "content.json"), "{}\n");
    const { stdout } = await runLive(repo, { online: online.url });
    assert.match(stdout, /not committed yet/);
    assert.match(stdout, /site\/content\.json/);
    assert.match(stdout, /is live/);
  } finally {
    await online.close();
    await remove();
  }
});

test("without a connection to the site, it says so instead of crashing", async () => {
  const { repo, remove } = await participantRepo();
  try {
    const { stdout, status } = await runLive(repo, { online: "http://127.0.0.1:9/" });
    assert.equal(status, 0);
    assert.match(stdout, /could not reach/i);
  } finally {
    await remove();
  }
});

test("a file name with an accent, such as città.svg, does not keep a live site from being reported live", async () => {
  const { repo, remove } = await participantRepo();
  await cp(join(repo, "site", "assets", "favicon.svg"), join(repo, "site", "assets", "città.svg"));
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "A picture of my city");
  git(repo, "push", "-q");
  const online = await onlineSite(repo);
  try {
    const { stdout } = await runLive(repo, { online: online.url });
    assert.match(stdout, /is live/);
  } finally {
    await online.close();
    await remove();
  }
});

test("a clone of an empty repo, with no commit yet, is told so in plain words", async () => {
  const dir = await mkdtemp(join(tmpdir(), "live-empty-"));
  try {
    const bare = join(dir, "github.git");
    git(dir, "init", "-q", "--bare", bare);
    git(dir, "clone", "-q", bare, "portfolio");
    const repo = join(dir, "portfolio");
    const origin = "https://github.com/Ada-Example/portfolio.git";
    git(repo, "remote", "set-url", "origin", origin);
    git(repo, "config", `url.${pathToFileURL(bare).href}.insteadOf`, origin);
    await cp(toolsDir, join(repo, "tools"), { recursive: true });
    const { stdout, status } = await runLive(repo);
    assert.equal(status, 0);
    assert.match(stdout, /no commit yet/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
