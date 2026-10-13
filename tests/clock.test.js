import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CLOCK_FILE, PACE, clockFooter, clockStatus, pace, readPlan, startRole } from "../tools/clock/clock.mjs";
import { templateDir, withRepo } from "./participant-repo.js";

// A day of the workshop, in local time: the clock reads the laptop's clock.
const at = (hours, mins) => new Date(2026, 9, 10, hours, mins);
const workshop = (dir, values) => writeFile(join(dir, "workshop.json"), JSON.stringify({ event: "Example Fest 2026", date: "2026-10-10", ...values }));
const run = (dir, tool, ...args) => spawnSync(process.execPath, [join(dir, "tools", tool), ...args], { cwd: dir, encoding: "utf8" });

test("pace: time to spare, on plan or short on time, by the time left against the work the plan still has after the step", () => {
  // A 15-minute Role, at a step planned for minute 5: 10 minutes of work still planned, a margin of 2.
  const at5 = (leftMinutes) => pace({ leftMs: leftMinutes * 60000, roleMinutes: 15, stepBy: 5 });
  assert.equal(at5(13), PACE.ahead);
  assert.equal(at5(12), PACE.ahead);
  assert.equal(at5(11), PACE.onTime);
  assert.equal(at5(9), PACE.onTime);
  assert.equal(at5(8), PACE.behind);
  assert.equal(at5(0), PACE.behind);
  // The margin grows with the Role: 15% of 22 minutes is 3.
  assert.equal(pace({ leftMs: 6.5 * 60000, roleMinutes: 22, stepBy: 18 }), PACE.onTime);
  assert.equal(pace({ leftMs: 7 * 60000, roleMinutes: 22, stepBy: 18 }), PACE.ahead);
  // The words describe the time, never the person.
  assert.deepEqual(PACE, { ahead: "time to spare", onTime: "on plan", behind: "short on time", home: "at home" });
});

test("in the room, a Role's time runs from its start, and the clock names the room's planned next Block", async () => {
  await withRepo(async (dir) => {
    await workshop(dir, { start: "16:00", end: "18:00" });
    // The Analyst's Block is planned from 16:28 to 16:43; this person starts at 16:30.
    const started = await startRole(dir, "analyst", at(16, 30));
    assert.equal(started.text, "Clock started: Analyst, at 16:30. 15 minutes, until 16:45. The room's plan: the next Block at 16:43.");
    const status = (mins) => clockStatus(dir, { step: "content-shown", now: at(16, mins) });
    assert.equal((await status(30)).pace, PACE.ahead);
    assert.equal((await status(34)).pace, PACE.onTime);
    assert.equal((await status(38)).pace, PACE.behind);
    assert.equal((await status(34)).text, "Clock: Analyst, 4 minutes used, 11 minutes left, until 16:45.\nPace: on plan.");
    assert.equal((await status(46)).text, "Clock: Analyst, 16 minutes used. The time is up: it ended at 16:45.\nPace: short on time.");
  });
});

test("a Block the room starts late moves the time with it: nobody is short on time because of the room's delay", async () => {
  await withRepo(async (dir) => {
    await workshop(dir, { start: "16:00", end: "18:00" });
    // Twelve minutes after the Analyst's planned start.
    await startRole(dir, "analyst", at(16, 40));
    assert.equal((await clockStatus(dir, { step: "content-shown", now: at(16, 44) })).pace, PACE.onTime);
  });
});

test("the workshop's end comes first: no Role runs past it", async () => {
  await withRepo(async (dir) => {
    await workshop(dir, { start: "16:00", end: "17:40" });
    const started = await startRole(dir, "ops", at(17, 33));
    assert.equal(started.text, "Clock started: Ops, at 17:33. 7 minutes, until 17:40. The room's plan: the next Block at 17:41.");
  });
});

test("on the workshop's day without a start time, the Role keeps its minutes and the room's plan stays unnamed", async () => {
  await withRepo(async (dir) => {
    await workshop(dir, {});
    const started = await startRole(dir, "designer", at(16, 50));
    assert.equal(started.text, "Clock started: Designer, at 16:50. 18 minutes, until 17:08.");
  });
});

test("at home nothing hurries: another day, or no workshop.json", async () => {
  for (const values of [{ start: "16:00", date: "2026-10-09" }, null]) {
    await withRepo(async (dir) => {
      if (values) await workshop(dir, values);
      const started = await startRole(dir, "designer", at(16, 50));
      assert.match(started.text, /^Clock started: Designer, at 16:50\. At home nothing hurries you/);
      const status = await clockStatus(dir, { step: "interview", now: at(17, 30) });
      assert.equal(status.pace, PACE.home);
      assert.equal(status.text, "Clock: Designer, 40 minutes since the start. At home nothing hurries you.\nPace: at home.");
    });
  }
});

test("the clock writes only workshop-clock.json, which Git ignores", async () => {
  await withRepo(async (dir) => {
    await startRole(dir, "developer", at(17, 1));
    assert.deepEqual(JSON.parse(await readFile(join(dir, CLOCK_FILE), "utf8")), { role: "developer", startedAt: at(17, 1).toISOString() });
    // Git for Windows checks files out with CRLF line endings.
    const ignored = (await readFile(join(templateDir, ".gitignore"), "utf8")).split(/\r?\n/);
    assert.ok(ignored.includes(`/${CLOCK_FILE}`));
  });
});

test("a tool prints the clock's lines only for a step of the Role whose clock runs", async () => {
  await withRepo(async (dir) => {
    await workshop(dir, { start: "16:00" });
    assert.equal(await clockFooter(dir, "check", at(17, 20)), "", "no clock yet");
    await startRole(dir, "developer", at(17, 1));
    assert.equal(await clockFooter(dir, "check", at(17, 20)), "\nClock: Developer, 19 minutes used, 3 minutes left, until 17:23.\nPace: on plan.");
    assert.equal(await clockFooter(dir, "check-content", at(17, 20)), "", "the Analyst's step, not the Developer's");
    // A clock from the day before is not today's.
    assert.equal(await clockFooter(dir, "check", new Date(2026, 9, 11, 17, 20)), "");
  });
});

test("an unknown Role or step gets a plain answer, and the command never fails", async () => {
  await withRepo(async (dir) => {
    const unknown = await startRole(dir, "lawyer", at(16, 0));
    assert.equal(unknown.ok, false);
    assert.match(unknown.text, /There is no Role "lawyer" in this workshop\. Use one of: analyst, designer, developer, qa, ops\./);
    assert.equal(existsSync(join(dir, CLOCK_FILE)), false);
    const result = run(dir, "clock.mjs", "status", "nonsense");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No clock runs for a Role with the step "nonsense"\. The steps are:/);
  });
});

test("the command: start, then status, then a tool's own lines, on this laptop's clock", async () => {
  await withRepo(async (dir) => {
    const started = run(dir, "clock.mjs", "start", "analyst");
    assert.equal(started.status, 0, started.stderr);
    assert.match(started.stdout, /^Clock started: Analyst, at \d\d:\d\d\. At home nothing hurries you/);
    const status = run(dir, "clock.mjs", "status", "content-shown");
    assert.match(status.stdout, /^Clock: Analyst, 0 minutes since the start\. At home nothing hurries you\.\nPace: at home\.\n$/);
    const checked = run(dir, "check-content.mjs");
    assert.match(checked.stdout, /is ready: it matches the schema\.\n\nClock: Analyst, 0 minutes since the start\. At home nothing hurries you\.\nPace: at home\.\n$/);
  });
});

test("the plan: every Role's steps in order and inside its time, and each step's tool prints the clock's lines for it", async () => {
  const plan = await readPlan(templateDir);
  for (const [role, { minutes, startsAt, steps }] of Object.entries(plan.roles)) {
    assert.ok(minutes > 0, role);
    assert.ok(startsAt === null || startsAt >= 0, role);
    let last = 0;
    for (const step of steps) {
      assert.ok(step.by > last && step.by < minutes, `${role}: ${step.id}`);
      last = step.by;
      if (!step.tool) continue;
      const source = await readFile(join(templateDir, "tools", `${step.tool}.mjs`), "utf8");
      assert.match(source, new RegExp(`clockFooter\\(.+, "${step.tool}"\\)`), `${step.tool}.mjs prints the clock's lines`);
    }
  }
});

const SKILL_OF = { analyst: "analyst", designer: "design", developer: "build", qa: "qa", ops: "deploy" };

test("AGENTS.md says how to read the pace, and every Role skill starts its clock and names each of its steps", async () => {
  const agents = await readFile(join(templateDir, "AGENTS.md"), "utf8");
  const rules = agents.split("## The Role clock")[1]?.split("\n## ")[0] ?? "";
  for (const word of Object.values(PACE)) assert.ok(rules.includes(`**${word}**`), `AGENTS.md: ${word}`);
  assert.match(rules, /If the clock command fails, or prints no `Pace:` line, take the normal path and say nothing about time\./);
  assert.match(rules, /never tell them they are slow or behind/);
  const plan = await readPlan(templateDir);
  for (const [role, { steps }] of Object.entries(plan.roles)) {
    const skill = await readFile(join(templateDir, ".agents", "skills", SKILL_OF[role], "SKILL.md"), "utf8");
    const clock = skill.split("## The clock")[1]?.split("\n## ")[0] ?? "";
    assert.ok(clock, `${role}: a section "The clock"`);
    assert.match(clock, new RegExp(`node tools/clock\\.mjs start ${role}\\r?\\n`), `${role}: starts its clock`);
    assert.match(clock, /`AGENTS\.md`, under "The Role clock"/, `${role}: points at the rules`);
    assert.match(clock, /This Role's must-do: /, `${role}: names its must-do`);
    for (const step of steps) {
      const row = clock.split(/\r?\n/).find((line) => line.startsWith(`| \`${step.id}\` |`));
      assert.ok(row, `${role}: a row for ${step.id}`);
      assert.ok(row.includes(step.tool ? `node tools/${step.tool}.mjs` : `node tools/clock.mjs status ${step.id}`), `${role}: where ${step.id}'s pace comes from`);
    }
  }
});
