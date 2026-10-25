import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// A throwaway laptop for the Mac/Linux Install script: a home folder of its
// own, stand-ins for agy, for Antigravity's installer and for the GitHub CLI,
// and the participant's repo folder already there, so nothing is fetched from
// the internet. tests/install/ and CI run the real thing.
const INSTALL = fileURLToPath(new URL("../install.sh", import.meta.url));

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

// The GitHub CLI as the account "ada" sees it. Every call is noted in
// ~/gh-calls. Signed in once ~/gh-signed-in exists; `auth login` creates it,
// unless ~/gh-refuses does. The repo ada/<name> answers from ~/gh-repo-<name>:
// missing, or the template it was made from (empty: made without one).
const STUB_GH = `#!/bin/sh
echo "$*" >> "$HOME/gh-calls"
case "$1 $2" in
  "--version "*) echo "gh version 2.103.2 (2026-10-23)"; exit 0 ;;
  "auth status") [ -f "$HOME/gh-signed-in" ] && exit 0; echo "You are not logged into any GitHub hosts." >&2; exit 1 ;;
  "auth login") [ -f "$HOME/gh-refuses" ] && exit 1; touch "$HOME/gh-signed-in"; exit 0 ;;
  "auth setup-git") exit 0 ;;
  "repo create") touch "$HOME/gh-repo-$3"; printf '%s' "$5" > "$HOME/gh-repo-$3"; exit 0 ;;
  "workflow run") exit 0 ;;
esac
if [ "$1" = api ]; then
  shift
  case "$*" in
    "user --jq .login") echo ada ;;
    "user --jq .id") echo 4242 ;;
    "user --jq .name // .login") echo "Ada Example" ;;
    "--method POST repos/ada/"*"/pages -f build_type=workflow") ;;
    repos/ada/*" --jq .template_repository.full_name // \\"\\"")
      name=\${1#repos/ada/}
      [ -f "$HOME/gh-repo-$name" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
      cat "$HOME/gh-repo-$name"; echo ;;
    repos/ada/*/contents/site/content.json*) ;;
    *) echo "stub gh: unknown api call: $*" >&2; exit 1 ;;
  esac
  exit 0
fi
echo "stub gh: unknown call: $*" >&2
exit 1
`;

export const usage = (fraction) =>
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

const executable = (path, text) => {
  writeFileSync(path, text);
  chmodSync(path, 0o755);
};

// gh: false (not installed), or { signedIn, refuses, repos: { name: template or "" } }.
export function setUp({ agyInstalled = true, settings, gh = false, gitName } = {}) {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "install-laptop-")));
  const stubs = join(home, "stubs");
  mkdirSync(stubs);
  mkdirSync(join(home, "bin"));
  executable(join(stubs, "agy"), STUB_AGY);
  // Antigravity's installer puts agy in ~/.local/bin.
  writeFileSync(join(stubs, "agy-installer.sh"), `mkdir -p "$HOME/.local/bin" && cp "${join(stubs, "agy")}" "$HOME/.local/bin/agy"\n`);
  if (agyInstalled) executable(join(home, "bin", "agy"), STUB_AGY);
  // The browser: never opened by a test, only noted in ~/opened.
  for (const name of ["open", "xdg-open"]) executable(join(home, "bin", name), `#!/bin/sh\necho "$1" >> "$HOME/opened"\n`);
  if (gh) {
    executable(join(home, "bin", "gh"), STUB_GH);
    if (gh.signedIn) writeFileSync(join(home, "gh-signed-in"), "");
    if (gh.refuses) writeFileSync(join(home, "gh-refuses"), "");
    for (const [name, template] of Object.entries(gh.repos ?? {})) writeFileSync(join(home, `gh-repo-${name}`), template);
  }
  if (settings !== undefined) {
    mkdirSync(join(home, ".gemini", "antigravity-cli"), { recursive: true });
    writeFileSync(join(home, ".gemini", "antigravity-cli", "settings.json"), settings);
  }
  if (gitName) writeFileSync(join(home, ".gitconfig"), `[user]\n\tname = ${gitName}\n\temail = ${gitName}@example.com\n`);
  // The participant's repo, cloned on an earlier run.
  const repo = join(home, "portfolio");
  mkdirSync(join(repo, "tools"), { recursive: true });
  mkdirSync(join(repo, "site"));
  writeFileSync(join(repo, "tools", "check.mjs"), "");
  writeFileSync(join(repo, "site", "content.json"), "{}");
  spawnSync("git", ["init", "-q", repo]);
  return { home, repo, stubs };
}

// With `terminal`, `script` gives the Install script a terminal, as
// Terminal.app does. `user` answers the username question up front, as
// PORTFOLIO_GITHUB_USER does; null leaves it to the script.
export function run({ home, stubs }, { quota = usage(0.8), terminal = false, user = "ada", env = {} } = {}) {
  const path = [join(home, "bin"), dirname(process.execPath), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");
  const vars = {
    HOME: home,
    PATH: path,
    TERM: "dumb",
    PORTFOLIO_AGY_INSTALLER: pathToFileURL(join(stubs, "agy-installer.sh")).href,
    STUB_USAGE: quota,
    // No Chrome DevTools for agents to download: the script says so and goes on.
    npm_config_cache: join(home, "npm-cache"),
    npm_config_registry: "http://127.0.0.1:9/",
    npm_config_fetch_retries: "0",
    ...(user ? { PORTFOLIO_GITHUB_USER: user } : {}),
    ...env,
  };
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

const readIf = (path) => (existsSync(path) ? readFileSync(path, "utf8") : null);

export const settingsIn = (home) => JSON.parse(readFileSync(join(home, ".gemini", "antigravity-cli", "settings.json"), "utf8"));
export const startedIn = (home) => readIf(join(home, "agy-started"))?.trim() ?? null;
export const opened = (home) => (readIf(join(home, "opened")) ?? "").split("\n").filter(Boolean);
export const ghCalls = (home) => (readIf(join(home, "gh-calls")) ?? "").split("\n").filter(Boolean);
export const gitConfig = (home, key) =>
  spawnSync("git", ["config", "--global", key], { env: { HOME: home, PATH: "/usr/bin:/bin" }, encoding: "utf8" }).stdout.trim();
