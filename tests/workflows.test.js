import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");

// The jobs of a workflow, each with its job-level `if:` (null when it has none).
// Every job found, checked against the job count from its `runs-on:` lines.
const jobsIn = (workflow) => {
  const jobs = [...(workflow.split(/^jobs:\n/m)[1] ?? "").matchAll(/^  ([\w-]+):(?: *#.*)?\n((?:(?: {4}.*)?\n)*)/gm)].map(
    ([, name, body]) => ({ name, condition: body.match(/^ {4}if: (.*)$/m)?.[1] ?? null }),
  );
  assert.equal(jobs.length, workflow.match(/^ {4}runs-on: /gm)?.length ?? 0, "every job found");
  return jobs;
};

// "Use this template" copies the workflows too. In a participant's copy these
// tests fail as soon as their site differs from the sample, and GitHub emails
// them "Run failed" after every push.
test("The template's own tests run only in the template, never in a participant's copy", async () => {
  const jobs = jobsIn(await read("../.github/workflows/ci.yml"));
  assert.ok(jobs.length > 0, "CI jobs");
  for (const job of jobs) {
    assert.equal(job.condition, "github.repository == 'fabkrum/portfolio-template'", job.name);
  }
});

test("Every copy publishes: the Pages deploy runs in every repo", async () => {
  const jobs = jobsIn(await read("../.github/workflows/deploy.yml"));
  assert.ok(jobs.length > 0, "a deploy job");
  for (const job of jobs) assert.equal(job.condition, null, job.name);
});

// The steps of a workflow's job, in order, each as its own text.
const stepsOf = (workflow, job) => {
  const body = workflow.split(new RegExp(`^  ${job}:\\n`, "m"))[1]?.split(/^  \S/m)[0] ?? "";
  return (body.split(/^ {4}steps:\n/m)[1] ?? "").split(/^ {6}- /m).slice(1);
};

test("Every copy publishes the built site: the deploy sets up Node, builds the site and uploads _site/", async () => {
  const steps = stepsOf(await read("../.github/workflows/deploy.yml"), "deploy");
  const at = (pattern) => steps.findIndex((step) => pattern.test(step));
  const order = [/uses: actions\/checkout@/, /uses: actions\/setup-node@/, /run: node tools\/build\.mjs$/m, /uses: actions\/upload-pages-artifact@/, /uses: actions\/deploy-pages@/].map(at);
  assert.ok(order.every((index) => index >= 0), JSON.stringify(order));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "in this order");
  assert.match(steps[at(/setup-node/)], /node-version: 22\b/);
  assert.match(steps[at(/upload-pages-artifact/)], /^ +path: _site$/m);
});

test("On the daily run, a copy without GitHub Pages switched on skips publishing quietly, never failing every day", async () => {
  const steps = stepsOf(await read("../.github/workflows/deploy.yml"), "deploy");
  const pages = steps.findIndex((step) => /uses: actions\/configure-pages@/.test(step));
  assert.match(steps[pages], /^ *id: pages$/m);
  assert.match(steps[pages], /^ *continue-on-error: \$\{\{ github\.event_name == 'schedule' \}\}$/m);
  // Every step after it runs only when GitHub Pages is there; on a push, a missing Pages fails the run as before.
  for (const step of steps.slice(pages + 1)) assert.match(step, /^ *if: steps\.pages\.outcome == 'success'$/m, step);
});

test("The deploy also runs once a day, so what depends on the date stays right without a push", async () => {
  const workflow = await read("../.github/workflows/deploy.yml");
  const triggers = workflow.split(/^on:\n/m)[1].split(/^\S/m)[0];
  assert.match(triggers, /^ {2}push:\n {4}branches: \[main\]$/m);
  assert.match(triggers, /^ {2}schedule:\n {4}- cron: "\d+ \d+ \* \* \*"$/m);
});

test("CI builds the sample site as the deploy does, on every operating system", async () => {
  const steps = stepsOf(await read("../.github/workflows/ci.yml"), "test");
  assert.ok(steps.some((step) => /^ +run: node tools\/build\.mjs$/m.test(step)));
});
