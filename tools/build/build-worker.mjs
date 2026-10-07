// One build in a worker thread of its own, for the preview (tools/preview.mjs):
// every build loads render.js, and every file it imports, fresh. It answers
// { warnings }, or { problem } in plain words.
import { parentPort, workerData } from "node:worker_threads";
import { BuildError, buildSite } from "./build-site.mjs";

const { siteDir, outDir, options } = workerData;
try {
  const { warnings } = await buildSite(siteDir, outDir, options);
  parentPort.postMessage({ warnings });
} catch (error) {
  parentPort.postMessage({
    problem: error instanceof BuildError ? error.message : `The build itself ran into a problem: ${error.message}`,
  });
}
