// A fixture site = the sample site, with the fixture's files laid over it
// and the files its fixture.json lists under "remove" deleted.
import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const sampleSite = fileURLToPath(new URL("../site", import.meta.url));

// Fixture folders only, so a stray .DS_Store or desktop.ini is not a fixture.
export const fixtureNames = async (dir) =>
  (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

export async function buildFixtureSite(fixturesDir, name) {
  const fixtureDir = join(fixturesDir, name);
  const fixturePath = join(fixtureDir, "fixture.json");
  const fixture = existsSync(fixturePath) ? JSON.parse(await readFile(fixturePath, "utf8")) : {};
  const siteDir = await mkdtemp(join(tmpdir(), `fixture-${name}-`));
  await cp(sampleSite, siteDir, { recursive: true });
  await cp(fixtureDir, siteDir, {
    recursive: true,
    filter: (source) => !source.endsWith("fixture.json"),
  });
  for (const file of fixture.remove ?? []) await rm(join(siteDir, file));
  return { siteDir, fixture, remove: () => rm(siteDir, { recursive: true, force: true }) };
}
