// Builds a site folder into a temporary folder of its own and serves it on a
// free local port, with that local address as the site's address: the site as
// the Check, look and the tests see it. A temporary folder, so that they never
// get in the way of a running preview. close() stops the server and removes
// the folder. Throws a BuildError when the site cannot be built.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveSite } from "../check/serve-site.mjs";
import { buildSite } from "./build-site.mjs";

export async function serveBuild(siteDir, options = {}) {
  const outDir = await mkdtemp(join(tmpdir(), "portfolio-built-"));
  const server = await serveSite(outDir).catch(async (error) => {
    await rm(outDir, { recursive: true, force: true });
    throw error;
  });
  const close = async () => {
    server.close();
    await rm(outDir, { recursive: true, force: true, maxRetries: 5 });
  };
  try {
    const build = await buildSite(siteDir, outDir, { address: `${server.origin}/`, ...options });
    return { origin: server.origin, outDir, build, close };
  } catch (error) {
    await close();
    throw error;
  }
}
