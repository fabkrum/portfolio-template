// The Role clock. Each Role's agent runs it once when the Role starts:
//
//   node tools/clock.mjs start analyst
//
// It notes the time in workshop-clock.json (Git ignores it) and says how much
// time the Role has. At a step without a tool of its own, the agent asks for
// the pace:
//
//   node tools/clock.mjs status content-shown
//
// It answers with the time used and left, and a pace against the plan in
// tools/clock/plan.json: time to spare, on plan, or short on time; at home,
// "at home". The same command on every system. It reads the clock, the plan
// and workshop.json, and writes nothing but workshop-clock.json.
import { fileURLToPath } from "node:url";
import { clockStatus, readPlan, startRole } from "./clock/clock.mjs";

const repoDir = fileURLToPath(new URL("..", import.meta.url));
// The command, and its role ("start analyst") or step ("status content-shown").
const [command, roleOrStep] = process.argv.slice(2);

async function main() {
  if (command === "start" && roleOrStep) {
    const { text } = await startRole(repoDir, roleOrStep.toLowerCase());
    console.log(text);
    return;
  }
  if (command === "status") {
    const status = await clockStatus(repoDir, { step: roleOrStep });
    if (status) {
      console.log(status.text);
      return;
    }
    if (roleOrStep) {
      const plan = await readPlan(repoDir);
      const steps = Object.entries(plan?.roles ?? {}).flatMap(([role, { steps = [] }]) => steps.map((s) => `${role}: ${s.id}`));
      console.log(`No clock runs for a Role with the step "${roleOrStep}". The steps are:\n  ${steps.join("\n  ")}`);
      console.log("Start the Role's clock first: node tools/clock.mjs start <role>");
      return;
    }
    console.log("No Role's clock runs. Start it with: node tools/clock.mjs start <role>");
    return;
  }
  console.log("Use: node tools/clock.mjs start <role>, or node tools/clock.mjs status <step>");
}

try {
  await main();
} catch (error) {
  // The clock never stands in the way: the Role goes on at its normal pace.
  console.log(`The clock could not run: ${error.message}. Go on at the normal pace.`);
}
process.exitCode = 0;
