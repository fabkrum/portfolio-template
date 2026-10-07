// The preview. Run it from your repo folder:
//
//   node tools/preview.mjs
//
// It builds your site into the folder _site/ and shows it at a local address
// in your own browser, the way it will look once published. Whenever you load
// a page and something in site/ has changed, it builds the site again first,
// so a reload shows your change. It keeps running until you press Ctrl+C.
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildInWorker } from "./build/build-site.mjs";
import { escapeHtml } from "./build/html.mjs";
import { serveSite } from "./check/serve-site.mjs";

const siteDir = fileURLToPath(new URL("../site", import.meta.url));
const outDir = fileURLToPath(new URL("../_site", import.meta.url));
const PORT = 8000;

// Every file in site/ with its size and the time it was last saved, and
// today's date: when none of them changed, the last build still holds.
async function snapshot() {
  const files = [];
  for (const entry of await readdir(siteDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const { size, mtimeMs } = await stat(path);
    files.push(`${path} ${size} ${mtimeMs}`);
  }
  return [new Date().toDateString(), ...files.sort()].join("\n");
}

let address;
let built = null;
let said = "";
let building = Promise.resolve();

// Tells the person in this window what changed about the build, once.
function say(message) {
  if (message === said) return;
  said = message;
  if (message) console.log(`\n${message}`);
}

// Builds the site again when site/ changed since the last build. Returns
// why the site could not be built, or null when it could.
function rebuild() {
  building = building.then(async () => {
    let now;
    try {
      now = await snapshot();
    } catch {
      now = null;
    }
    if (!now) {
      built = { snapshot: null, problem: `There is no site folder at ${siteDir}.` };
    } else if (now !== built?.snapshot || !existsSync(join(outDir, "index.html"))) {
      const before = built;
      const { warnings, problem } = await buildInWorker(siteDir, outDir, { address });
      built = { snapshot: now, problem };
      if (problem) say(`Your site could not be built: ${problem}\nThe preview shows this until it is fixed; then reload the page.`);
      else if (warnings.length > 0) say(`Built your site. Needs your attention:\n${warnings.map((warning) => `  - ${warning}`).join("\n")}`);
      else say(before?.problem ? "Your site builds again." : "");
    }
    return built.problem;
  });
  return building;
}

// The page the browser shows while the site cannot be built.
const problemPage = (problem) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Your site could not be built</title>
  </head>
  <body>
    <main>
      <h1>Your site could not be built</h1>
      <p>${escapeHtml(problem)}</p>
      <p>Fix it, then reload this page.</p>
    </main>
  </body>
</html>
`;

const options = {
  beforePage: async () => {
    const problem = await rebuild();
    return problem && problemPage(problem);
  },
};

let server;
try {
  server = await serveSite(outDir, PORT, options);
} catch (error) {
  if (error.code !== "EADDRINUSE") throw error;
  // Something else already uses port 8000: take any free port instead.
  server = await serveSite(outDir, 0, options);
}
address = `http://localhost:${server.port}/`;
console.log(`Your site is running at http://localhost:${server.port}`);
console.log("Open that address in Chrome. After a change, reload the page: the preview builds your site again first.");
console.log("To stop the preview, press Ctrl+C in this window.");
await rebuild();
