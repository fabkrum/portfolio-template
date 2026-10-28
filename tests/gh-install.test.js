import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { ghCalls, gitConfig, opened, run, setUp, settingsIn } from "./install-laptop.js";

// The GitHub part of the Mac/Linux Install script, with a stand-in GitHub CLI
// on a throwaway laptop (tests/install-laptop.js). In a terminal and without
// a username up front, the script signs in with the GitHub CLI and does the
// GitHub steps itself.
const skip = process.platform === "win32" ? "the Mac/Linux script" : false;
const TEMPLATE = "fabkrum/portfolio-template";
const viaGitHubCli = { terminal: true, user: null };

test("signs in to GitHub in the browser, and takes the username from the sign-in", { skip }, () => {
  const laptop = setUp({ gh: { repos: { portfolio: TEMPLATE } } });
  const { said } = run(laptop, viaGitHubCli);
  assert.ok(ghCalls(laptop.home).some((call) => call.startsWith("auth login --hostname github.com --git-protocol https --web")), said);
  assert.match(said, /\[ok\] {4}Signed in to GitHub as ada\./);
  assert.doesNotMatch(said, /What is your GitHub username\?/);
  assert.deepEqual(opened(laptop.home), ["https://github.com/login/device"]);
  rmSync(laptop.home, { recursive: true });
});

test("signed in already: no second sign-in", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: TEMPLATE } } });
  const { said } = run(laptop, viaGitHubCli);
  assert.ok(!ghCalls(laptop.home).some((call) => call.startsWith("auth login")), said);
  assert.match(said, /Signed in to GitHub as ada\./);
  rmSync(laptop.home, { recursive: true });
});

test("no repo yet: creates it from the Template, public, and switches GitHub Pages on", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true } });
  const { said } = run(laptop, viaGitHubCli);
  const calls = ghCalls(laptop.home);
  assert.ok(calls.includes(`repo create portfolio --template ${TEMPLATE} --public`), calls.join("\n"));
  assert.ok(calls.includes("api --method POST repos/ada/portfolio/pages -f build_type=workflow"), calls.join("\n"));
  assert.match(said, /\[ok\] {4}Created your repo https:\/\/github\.com\/ada\/portfolio from the workshop's template\./);
  assert.match(said, /https:\/\/ada\.github\.io\/portfolio\//);
  rmSync(laptop.home, { recursive: true });
});

test("a copy of the Template there already: used as it is", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: TEMPLATE } } });
  const { said } = run(laptop, viaGitHubCli);
  assert.ok(!ghCalls(laptop.home).some((call) => call.startsWith("repo create")));
  assert.match(said, /\[ok\] {4}Your repo is on GitHub: https:\/\/github\.com\/ada\/portfolio/);
  rmSync(laptop.home, { recursive: true });
});

test("another repo called portfolio (a live site): left alone, and the new repo gets another name", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: "" } } });
  // Nothing typed: the suggested name is taken.
  const { said } = run(laptop, viaGitHubCli);
  const calls = ghCalls(laptop.home);
  assert.ok(!calls.some((call) => call.includes("repos/ada/portfolio/pages")), calls.join("\n"));
  assert.match(said, /You already have a repo called portfolio on GitHub, and it is not a copy of the workshop's template\. It stays as it is\./);
  assert.match(said, /Name for your new repo \[portfolio-2026\]:/);
  assert.ok(calls.includes(`repo create portfolio-2026 --template ${TEMPLATE} --public`), calls.join("\n"));
  assert.match(said, /https:\/\/ada\.github\.io\/portfolio-2026\//);
  rmSync(laptop.home, { recursive: true });
});

test("git push uses the GitHub sign-in, and commits get a name and the noreply address", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: TEMPLATE } } });
  run(laptop, viaGitHubCli);
  assert.ok(ghCalls(laptop.home).includes("auth setup-git"));
  assert.equal(gitConfig(laptop.home, "user.name"), "Ada Example");
  assert.equal(gitConfig(laptop.home, "user.email"), "4242+ada@users.noreply.github.com");
  rmSync(laptop.home, { recursive: true });
});

test("a name Git has already stays", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: TEMPLATE } }, gitName: "Grace" });
  run(laptop, viaGitHubCli);
  assert.equal(gitConfig(laptop.home, "user.name"), "Grace");
  assert.equal(gitConfig(laptop.home, "user.email"), "Grace@example.com");
  rmSync(laptop.home, { recursive: true });
});

test("sign-in refused (a company account): asks for the username, as without the GitHub CLI", { skip }, () => {
  const laptop = setUp({ gh: { refuses: true } });
  const { said } = run(laptop, viaGitHubCli);
  assert.match(said, /The sign-in to GitHub did not finish/);
  assert.match(said, /What is your GitHub username\?/);
  assert.ok(!ghCalls(laptop.home).some((call) => call.startsWith("repo create")));
  rmSync(laptop.home, { recursive: true });
});

test("a username up front, or no terminal: no GitHub CLI at all", { skip }, () => {
  for (const options of [{ terminal: true }, { terminal: false, user: null, env: { PORTFOLIO_GITHUB_USER: "ada" } }, { terminal: true, user: null, env: { PORTFOLIO_UNATTENDED: "1", PORTFOLIO_GITHUB_USER: "ada" } }]) {
    const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: TEMPLATE } } });
    run(laptop, options);
    assert.deepEqual(ghCalls(laptop.home), [], JSON.stringify(options));
    rmSync(laptop.home, { recursive: true });
  }
});

test("the repo folder is trusted in the Antigravity CLI as well", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: TEMPLATE } } });
  run(laptop, viaGitHubCli);
  assert.deepEqual(settingsIn(laptop.home).trustedWorkspaces, [laptop.repo]);
  rmSync(laptop.home, { recursive: true });
});

test("a later run finds the repo made under the suggested name, without asking again", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: "", "portfolio-2026": TEMPLATE } } });
  const { said } = run(laptop, viaGitHubCli);
  assert.doesNotMatch(said, /Name for your new repo/);
  assert.match(said, /Your repo is on GitHub: https:\/\/github\.com\/ada\/portfolio-2026/);
  assert.match(said, /cd portfolio-2026, then agy/);
  rmSync(laptop.home, { recursive: true });
});

test("Pages just switched on for a repo that was there: the site is deployed once", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true, repos: { portfolio: TEMPLATE } } });
  run(laptop, viaGitHubCli);
  assert.ok(ghCalls(laptop.home).includes("workflow run deploy.yml -R ada/portfolio"), ghCalls(laptop.home).join("\n"));
  rmSync(laptop.home, { recursive: true });
});
