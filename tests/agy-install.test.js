import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { run, settingsIn, setUp, startedIn, usage } from "./install-laptop.js";

// The Antigravity CLI part of the Mac/Linux Install script, on a throwaway
// laptop (tests/install-laptop.js).
const skip = process.platform === "win32" ? "the Mac/Linux script" : false;

// Auto mode and the workshop's model; the repo folder is trusted, so agy
// starts without asking.
const workshopSettings = (repo) => ({ agentMode: "auto", model: "Gemini 3.8 Flash (Low)", trustedWorkspaces: [repo] });

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

test("sets the Antigravity CLI to auto mode and the workshop's model, and trusts the repo folder", { skip }, () => {
  const laptop = setUp();
  const { said } = run(laptop);
  assert.deepEqual(settingsIn(laptop.home), workshopSettings(laptop.repo));
  assert.match(said, /auto mode, with Gemini 3\.8 Flash/);
  rmSync(laptop.home, { recursive: true });
});

test("keeps every other setting of the Antigravity CLI", { skip }, () => {
  const mine = { trustedWorkspaces: ["/Users/ada/notes"], model: "Gemini 4 Argon", agentMode: "plan", theme: { dark: true } };
  const laptop = setUp({ settings: JSON.stringify(mine, null, 2) });
  run(laptop);
  assert.deepEqual(settingsIn(laptop.home), { ...mine, ...workshopSettings(laptop.repo), trustedWorkspaces: ["/Users/ada/notes", laptop.repo] });
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

test("without a terminal, or with PORTFOLIO_UNATTENDED, starts nothing and says how to start it", { skip }, () => {
  for (const options of [{}, { terminal: true, env: { PORTFOLIO_UNATTENDED: "1" } }]) {
    const laptop = setUp();
    const { said } = run(laptop, options);
    assert.equal(startedIn(laptop.home), null, said);
    assert.match(said, /cd portfolio/);
    assert.match(said, /then agy/);
    rmSync(laptop.home, { recursive: true });
  }
});
