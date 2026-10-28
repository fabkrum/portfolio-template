import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ghCalls, run, settingsIn, setUp, startedIn } from "./install-laptop.js";

// At home, the prep page's line sets WORKSHOP_PREP=1: the tools and both
// sign-ins, but no repo. The repo is made in the room, by the guide's line,
// from the template of the event's format, so one prep page serves the 90-
// and the 120-minute workshop.
const skip = process.platform === "win32" ? "the Mac/Linux script" : false;
const atHome = { terminal: true, user: null, env: { WORKSHOP_PREP: "1" } };

test("prep: signs in to GitHub, but makes no repo and switches no Pages on", { skip }, () => {
  const laptop = setUp({ gh: {} });
  const { said } = run(laptop, atHome);
  const calls = ghCalls(laptop.home);
  assert.ok(calls.some((call) => call.startsWith("auth login")), said);
  assert.match(said, /Signed in to GitHub as ada\./);
  assert.ok(!calls.some((call) => call.startsWith("repo create") || call.includes("/pages")), calls.join("\n"));
  assert.match(said, /Your repo is made in the workshop/);
  assert.match(said, /git push uses your GitHub sign-in\./);
  rmSync(laptop.home, { recursive: true });
});

test("prep: no workshop.json, even with an event named", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true } });
  run(laptop, { ...atHome, env: { ...atHome.env, WORKSHOP_EVENT: "DevFest Test" } });
  assert.ok(!existsSync(join(laptop.repo, "workshop.json")));
  rmSync(laptop.home, { recursive: true });
});

test("prep: signed out of the Antigravity CLI, it starts in the prep folder for the sign-in", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true } });
  const { said } = run(laptop, { ...atHome, quota: "signed-out" });
  const prepDir = join(laptop.home, ".portfolio-prep");
  assert.equal(startedIn(laptop.home), prepDir, said);
  assert.ok(settingsIn(laptop.home).trustedWorkspaces.includes(prepDir));
  assert.match(said, /type \/exit and press Enter/);
  rmSync(laptop.home, { recursive: true });
});

test("prep: signed in already, nothing starts", { skip }, () => {
  const laptop = setUp({ gh: { signedIn: true } });
  const { said } = run(laptop, atHome);
  assert.equal(startedIn(laptop.home), null, said);
  assert.match(said, /Everything is ready\./);
  assert.match(said, /the guide gives you one more line: it makes your repo/);
  rmSync(laptop.home, { recursive: true });
});

test("prep: the GitHub sign-in refused, it asks for no username and goes on", { skip }, () => {
  const laptop = setUp({ gh: { refuses: true } });
  const { said } = run(laptop, atHome);
  assert.doesNotMatch(said, /What is your GitHub username\?/);
  assert.match(said, /asks for the GitHub sign-in again/);
  assert.match(said, /Antigravity CLI/);
  rmSync(laptop.home, { recursive: true });
});
