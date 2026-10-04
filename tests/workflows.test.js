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
