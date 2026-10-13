// The Role clock: when a Role started, how much of its time is used and how
// much is left against the plan, so a Role's agent can choose how deep to go.
// tools/clock.mjs is the command; the Check, the content and brief checks,
// look and live print the same lines at their end (clockFooter), so the agent
// learns the time without one more command for the person to allow.
//
// The plan is tools/clock/plan.json: each Role's minutes, the minute its
// Block starts after the workshop's start, and its steps, each with the
// minute it should be done by. A Role's time runs from the moment its clock
// starts: the room starts each Block together, so a Block that starts late
// moves everyone's time with it. workshop.json, which the Install script
// writes from the guide's line, says whether today is the workshop's day; its
// end time (WORKSHOP_END) is a limit no Role runs past, and its start time
// (WORKSHOP_START) lets the clock name the room's planned next Block. On
// another day, or without workshop.json, the person is at home, and nothing
// hurries them.
//
// The pace words describe the time, never the person: "time to spare",
// "on plan", "short on time", or "at home". The person may read them too.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const CLOCK_FILE = "workshop-clock.json";
// A clock older than this belongs to another day or another session.
const STALE_MS = 12 * 60 * 60 * 1000;
const ROLE_NAMES = { analyst: "Analyst", designer: "Designer", developer: "Developer", qa: "QA", ops: "Ops" };
export const PACE = { ahead: "time to spare", onTime: "on plan", behind: "short on time", home: "at home" };

const pad = (n) => String(n).padStart(2, "0");
const clockTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const localDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const minutesOf = (ms) => Math.floor(ms / 60000);
const counted = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const roleName = (roleId) => ROLE_NAMES[roleId] ?? roleId;

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

export const readPlan = (repoDir) => readJson(join(repoDir, "tools", "clock", "plan.json"));

// "11:45" on the given day, or null when the text is not a time of day.
function atTime(text, day) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? ""));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const at = new Date(day);
  at.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return at;
}

// The workshop's day as workshop.json describes it, or null at home: another
// day, no workshop.json, or a Role with no Block in the room. deadline: the
// Role's minutes from its start, never past the workshop's end. nextBlock:
// when the room's plan starts the next Block, if the start time is known.
async function inTheRoom(repoDir, role, startedAt) {
  const workshop = await readJson(join(repoDir, "workshop.json"));
  if (!workshop || workshop.date !== localDate(startedAt) || typeof role.startsAt !== "number") return null;
  let deadline = new Date(startedAt.getTime() + role.minutes * 60000);
  const end = atTime(workshop.end, startedAt);
  if (end && end > startedAt && end < deadline) deadline = end;
  const start = atTime(workshop.start, startedAt);
  const nextBlock = start ? new Date(start.getTime() + (role.startsAt + role.minutes) * 60000) : null;
  return { deadline, nextBlock };
}

const roomPlan = ({ nextBlock }) => (nextBlock ? ` The room's plan: the next Block at ${clockTime(nextBlock)}.` : "");

// Starts the clock for a Role. Returns what to tell the person.
export async function startRole(repoDir, roleId, now = new Date()) {
  const plan = await readPlan(repoDir);
  const role = plan?.roles?.[roleId];
  if (!role) {
    const known = Object.keys(plan?.roles ?? ROLE_NAMES).join(", ");
    return { ok: false, text: `There is no Role "${roleId}" in this workshop. Use one of: ${known}.` };
  }
  await writeFile(join(repoDir, CLOCK_FILE), `${JSON.stringify({ role: roleId, startedAt: now.toISOString() }, null, 2)}\n`);
  const room = await inTheRoom(repoDir, role, now);
  if (!room) {
    return {
      ok: true,
      text: `Clock started: ${roleName(roleId)}, at ${clockTime(now)}. At home nothing hurries you: take the time you need. In the workshop this Role has ${counted(role.minutes, "minute")}.`,
    };
  }
  const left = minutesOf(room.deadline - now);
  return {
    ok: true,
    text: `Clock started: ${roleName(roleId)}, at ${clockTime(now)}. ${counted(left, "minute")}, until ${clockTime(room.deadline)}.${roomPlan(room)}`,
  };
}

// The running Role's clock, or null when none runs (or it is stale).
async function runningClock(repoDir, now) {
  const clock = await readJson(join(repoDir, CLOCK_FILE));
  const startedAt = new Date(clock?.startedAt ?? NaN);
  if (!clock?.role || Number.isNaN(startedAt.getTime())) return null;
  if (now - startedAt > STALE_MS || startedAt - now > 60000) return null;
  return { roleId: clock.role, startedAt };
}

// The pace at a step. The rule: is the time left more, or less, than the
// work the plan still has after this step, by a margin of 15% of the Role's
// minutes, at least two?
export function pace({ leftMs, roleMinutes, stepBy }) {
  const margin = Math.max(2, Math.round(roleMinutes * 0.15));
  const left = leftMs / 60000;
  const stillPlanned = roleMinutes - stepBy;
  if (left <= 0) return PACE.behind;
  if (left >= stillPlanned + margin) return PACE.ahead;
  if (left <= stillPlanned - margin) return PACE.behind;
  return PACE.onTime;
}

// The clock's lines for a step of the running Role, given by its id (step)
// or by the tool that ends it (tool). Null when no clock runs, or the step
// is not one of this Role's.
export async function clockStatus(repoDir, { step, tool, now = new Date() } = {}) {
  const clock = await runningClock(repoDir, now);
  if (!clock) return null;
  const plan = await readPlan(repoDir);
  const role = plan?.roles?.[clock.roleId];
  if (!role) return null;
  const steps = role.steps ?? [];
  const found = step ? steps.find((s) => s.id === step) : tool ? steps.find((s) => s.tool === tool) : null;
  if ((step || tool) && !found) return null;

  const name = roleName(clock.roleId);
  const used = minutesOf(now - clock.startedAt);
  const room = await inTheRoom(repoDir, role, clock.startedAt);
  if (!room) {
    return {
      role: clock.roleId,
      pace: PACE.home,
      text: `Clock: ${name}, ${counted(used, "minute")} since the start. At home nothing hurries you.\nPace: ${PACE.home}.`,
    };
  }
  const leftMs = room.deadline - now;
  const timeLine =
    leftMs <= 0
      ? `Clock: ${name}, ${counted(used, "minute")} used. The time is up: it ended at ${clockTime(room.deadline)}.`
      : `Clock: ${name}, ${counted(used, "minute")} used, ${counted(minutesOf(leftMs), "minute")} left, until ${clockTime(room.deadline)}.`;
  if (!found) return { role: clock.roleId, pace: null, text: timeLine };
  const result = pace({ leftMs, roleMinutes: role.minutes, stepBy: found.by });
  return { role: clock.roleId, pace: result, text: `${timeLine}\nPace: ${result}.` };
}

// What a tool prints at its end: a blank line and the clock's lines, when a
// Role's clock runs and this tool ends one of its steps. Never throws: a
// clock that fails must not break the tool.
export async function clockFooter(repoDir, tool, now = new Date()) {
  try {
    const status = await clockStatus(repoDir, { tool, now });
    return status ? `\n${status.text}` : "";
  } catch {
    return "";
  }
}
