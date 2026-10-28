import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The Antigravity CLI part of the Mac/Linux Install script, run against a
// throwaway home folder: a stand-in agy and a stand-in for Antigravity's own
// installer, and a repo folder that is already there, so nothing is fetched
// from the internet. tests/install/ and CI run the real thing.
const INSTALL = fileURLToPath(new URL("../install.sh", import.meta.url));
const skip = process.platform === "win32" ? "the Mac/Linux script" : false;

const WORKSHOP_SETTINGS = { agentMode: "auto", model: "Gemini 3.8 Flash (Low)" };

// Answers `agy -p /usage` with $STUB_USAGE, or asks for the sign-in and waits
// the way agy does; started without -p, it notes the folder it started in.
const STUB_AGY = `#!/bin/sh
if [ "$1" = --version ]; then echo 1.4.7; exit 0; fi
if [ "$1" = -p ]; then
  if [ "$STUB_USAGE" = signed-out ]; then
    echo "Authentication required. Please visit the URL to log in:"
    sleep 60
    exit 1
  fi
  printf '%s' "$STUB_USAGE"
  exit 0
fi
pwd > "$HOME/agy-started"
`;

const usage = (fraction) =>
  JSON.stringify({
    status: "SUCCESS",
    command: {
      name: "usage",
      data: {
        groups: [
          { name: "Gemini Models", buckets: [{ id: "gemini-weekly", window: "weekly", remaining_fraction: fraction }] },
          { name: "Claude and GPT models", buckets: [{ id: "3p-weekly", window: "weekly", remaining_fraction: 1 }] },
        ],
      },
    },
  });

function setUp({ agyInstalled = true, settings } = {}) {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "agy-install-")));
  const stubs = join(home, "stubs");
  mkdirSync(stubs);
  writeFileSync(join(stubs, "agy"), STUB_AGY);
  chmodSync(join(stubs, "agy"), 0o755);
  // Antigravity's installer puts agy in ~/.local/bin.
  writeFileSync(
    join(stubs, "agy-installer.sh"),
    `mkdir -p "$HOME/.local/bin" && cp "${join(stubs, "agy")}" "$HOME/.local/bin/agy"\n`,
  );
  if (agyInstalled) {
    mkdirSync(join(home, "bin"));
    writeFileSync(join(home, "bin", "agy"), STUB_AGY);
    chmodSync(join(home, "bin", "agy"), 0o755);
  }
  if (settings !== undefined) {
    mkdirSync(join(home, ".gemini", "antigravity-cli"), { recursive: true });
    writeFileSync(join(home, ".gemini", "antigravity-cli", "settings.json"), settings);
  }
  // The participant's repo, cloned on an earlier run.
  const repo = join(home, "portfolio");
  mkdirSync(join(repo, "tools"), { recursive: true });
  mkdirSync(join(repo, "site"));
  writeFileSync(join(repo, "tools", "check.mjs"), "");
  writeFileSync(join(repo, "site", "content.json"), "{}");
  spawnSync("git", ["init", "-q", repo]);
  return { home, repo, stubs };
}

function run({ home, stubs }, { quota = usage(0.8), terminal = false, env = {} } = {}) {
  const path = [join(home, "bin"), dirname(process.execPath), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");
  const vars = {
    HOME: home,
    PATH: path,
    TERM: "dumb",
    PORTFOLIO_GITHUB_USER: "ada",
    PORTFOLIO_AGY_INSTALLER: pathToFileURL(join(stubs, "agy-installer.sh")).href,
    STUB_USAGE: quota,
    // No Chrome DevTools for agents to download: the script says so and goes on.
    npm_config_cache: join(home, "npm-cache"),
    npm_config_registry: "http://127.0.0.1:9/",
    npm_config_fetch_retries: "0",
    ...env,
  };
  // `script` gives the Install script a terminal, as Terminal.app does.
  const [command, args] = !terminal
    ? ["sh", [INSTALL]]
    : process.platform === "darwin"
      ? ["script", ["-q", "/dev/null", "sh", INSTALL]]
      : ["script", ["-qec", `sh ${INSTALL}`, "/dev/null"]];
  const started = Date.now();
  // Nothing to read: a pipe would stop macOS's script, which wants a terminal or a file.
  const result = spawnSync(command, args, { env: vars, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
  return { said: result.stdout + result.stderr, seconds: (Date.now() - started) / 1000 };
}

const settingsIn = (home) => JSON.parse(readFileSync(join(home, ".gemini", "antigravity-cli", "settings.json"), "utf8"));
const startedIn = (home) => (existsSync(join(home, "agy-started")) ? readFileSync(join(home, "agy-started"), "utf8").trim() : null);

test("installs the Antigravity CLI with Antigravity's own installer when it is missing", { skip }, () => {
  const laptop = setUp({ agyInstalled: false });
  const { said } = run(laptop);
  assert.match(said, /\[ok\] {4}Installed the Antigravity CLI \(agy 1\.4\.7\)\./);
  assert.ok(existsSync(join(laptop.home, ".local", "bin", "agy")));
  // Found in this window too: the settings and the quota check ran.
  assert.match(said, /80% of this week's Gemini quota left/);
  // And in new terminals, also on a Mac without a ~/.zshrc so far.
  assert.match(readFileSync(join(laptop.home, ".zshrc"), "utf8"), /export PATH="\$HOME\/\.local\/bin:\$PATH"/);
  assert.match(said, /open a new terminal window/);
  rmSync(laptop.home, { recursive: true });
});

test("finds an Antigravity CLI that is already installed", { skip }, () => {
  const laptop = setUp();
  const { said } = run(laptop);
  assert.match(said, /\[ok\] {4}The Antigravity CLI is installed \(agy 1\.4\.7\)\./);
  assert.ok(!existsSync(join(laptop.home, ".local", "bin", "agy")));
  rmSync(laptop.home, { recursive: true });
});

test("sets the Antigravity CLI to auto mode and the workshop's model", { skip }, () => {
  const laptop = setUp();
  const { said } = run(laptop);
  assert.deepEqual(settingsIn(laptop.home), WORKSHOP_SETTINGS);
  assert.match(said, /auto mode, with Gemini 3\.8 Flash/);
  rmSync(laptop.home, { recursive: true });
});

test("keeps every other setting of the Antigravity CLI", { skip }, () => {
  const mine = { trustedWorkspaces: ["/Users/ada/notes"], model: "Gemini 4 Argon", agentMode: "plan", theme: { dark: true } };
  const laptop = setUp({ settings: JSON.stringify(mine, null, 2) });
  run(laptop);
  assert.deepEqual(settingsIn(laptop.home), { ...mine, ...WORKSHOP_SETTINGS });
  rmSync(laptop.home, { recursive: true });
});

test("leaves a settings file it cannot read as it is, and says so", { skip }, () => {
  const broken = '{ "model": "Gemini 4 Argon", ';
  const laptop = setUp({ settings: broken });
  const { said } = run(laptop);
  assert.equal(readFileSync(join(laptop.home, ".gemini", "antigravity-cli", "settings.json"), "utf8"), broken);
  assert.match(said, /could not be read/);
  rmSync(laptop.home, { recursive: true });
});

test("says how much of the week's Gemini quota is left", { skip }, () => {
  const laptop = setUp();
  const { said } = run(laptop, { quota: usage(0.8) });
  assert.match(said, /\[ok\] {4}Your Google account has 80% of this week's Gemini quota left\./);
  assert.doesNotMatch(said, /may run out/);
  rmSync(laptop.home, { recursive: true });
});

test("below 60%, warns that the quota may run out, and still finishes", { skip }, () => {
  const laptop = setUp();
  const { said } = run(laptop, { quota: usage(0.27) });
  assert.match(said, /27% of this week's Gemini quota left/);
  assert.match(said, /may run out/);
  assert.match(said, /Run this command again any time/);
  rmSync(laptop.home, { recursive: true });
});

test("not signed in yet: says the Antigravity CLI asks for the Google sign-in, without waiting for it", { skip }, () => {
  const laptop = setUp();
  const { said, seconds } = run(laptop, { quota: "signed-out" });
  assert.match(said, /sign in with your Google account/);
  assert.ok(seconds < 30, `took ${seconds} s`);
  rmSync(laptop.home, { recursive: true });
});

test("in a terminal, ends by starting the Antigravity CLI in the repo folder", { skip }, () => {
  const laptop = setUp();
  const { said } = run(laptop, { terminal: true });
  assert.equal(startedIn(laptop.home), laptop.repo, said);
  rmSync(laptop.home, { recursive: true });
});

test("without a terminal, or with PORTFOLIO_NO_AGENT, starts nothing and says how to start it", { skip }, () => {
  for (const options of [{}, { terminal: true, env: { PORTFOLIO_NO_AGENT: "1" } }]) {
    const laptop = setUp();
    const { said } = run(laptop, options);
    assert.equal(startedIn(laptop.home), null, said);
    assert.match(said, /cd portfolio/);
    assert.match(said, /then agy/);
    rmSync(laptop.home, { recursive: true });
  }
});
