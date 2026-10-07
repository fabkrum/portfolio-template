// Where am I? Run it from your repo folder:
//
//   node tools/where.mjs
//
// It reads your repo and says which Roles are done, judged from the files
// each Role writes, and which Role comes next: its page in the guide and the
// sentence that starts it in a fresh chat. It changes nothing and needs no
// network: what it says about GitHub is what Git knows on this computer.
import { fileURLToPath } from "node:url";
import { whereAmI } from "./where/where-am-i.mjs";

const repoDir = fileURLToPath(new URL("..", import.meta.url));

// Each Role: its name, how a sentence names it, and its page in the guide.
const ROLES = {
  analyst: { name: "Analyst", called: "the Analyst", page: 2 },
  designer: { name: "Designer", called: "the Designer", page: 3 },
  developer: { name: "Developer", called: "the Developer", page: 4 },
  qa: { name: "QA", called: "QA", page: 5 },
  lawyer: { name: "Lawyer", called: "the Lawyer", page: 6 },
  ops: { name: "Ops", called: "Ops", page: 7 },
};

// The sentence that starts a Role, as the guide gives it.
const start = (block) => `Start the ${ROLES[block].name} step.`;

function report({ roles, next }) {
  console.log("Where you are, Role by Role:");
  for (const { block, state, note } of roles) console.log(`  ${state.padEnd(8)} ${ROLES[block].name} – ${note}`);
  console.log("");
  if (!next) {
    console.log("Next: Guide page 8: Feedback.");
    console.log("To see whether your site is live, run node tools/live.mjs.");
    console.log("To add a section to your site, start a fresh chat and type: Add a YouTube section to my portfolio.");
    return;
  }
  const role = ROLES[next];
  console.log(`Next: ${role.called}. Guide page ${role.page}: ${role.name}.`);
  console.log(`Start a fresh chat and type: ${start(next)}`);
  // Saying "default" to the Designer keeps the default brief, so the files cannot tell.
  if (next === "designer" && roles[1].defaultBrief) {
    console.log(`Already said default to the Designer? Then the Developer is next: ${start("developer")}`);
  }
  console.log("Behind the room? Type: Catch me up: the room just finished the <Role> block.");
}

const nodeMajor = Number(process.versions.node.split(".")[0]);

if (nodeMajor < 22) {
  console.log(`This needs Node 22 or newer; this is Node ${process.versions.node}.`);
  console.log("Run the install script again, or install the current Node LTS from nodejs.org.");
  process.exitCode = 1;
} else {
  try {
    report(await whereAmI(repoDir));
  } catch (error) {
    console.log(`Could not find out where you are: ${error.message}.`);
    console.log("Nothing was changed. Ask the instructor for help.");
    process.exitCode = 1;
  }
}
