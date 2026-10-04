// A fixture site = the sample site, with the fixture's files laid over it
// and the files its fixture.json lists under "remove" deleted. A fixture.json
// may name a "base": another fixture folder, relative to this one, that is
// laid over the sample site first.
import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const sampleSite = fileURLToPath(new URL("../site", import.meta.url));

// Fixture folders only, so a stray .DS_Store or desktop.ini is not a fixture.
export const fixtureNames = async (dir) =>
  (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

const readFixture = async (fixtureDir) => {
  const path = join(fixtureDir, "fixture.json");
  return existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : {};
};

// Lays the fixture, after its bases, over the site folder.
async function layFixture(fixtureDir, siteDir) {
  const fixture = await readFixture(fixtureDir);
  if (fixture.base) await layFixture(resolve(fixtureDir, fixture.base), siteDir);
  await cp(fixtureDir, siteDir, {
    recursive: true,
    filter: (source) => !source.endsWith("fixture.json"),
  });
  for (const file of fixture.remove ?? []) await rm(join(siteDir, file));
  return fixture;
}

export async function buildFixtureSite(fixturesDir, name) {
  const siteDir = await mkdtemp(join(tmpdir(), `fixture-${name.replaceAll("/", "-")}-`));
  await cp(sampleSite, siteDir, { recursive: true });
  const fixture = await layFixture(join(fixturesDir, name), siteDir);
  return { siteDir, fixture, remove: () => rm(siteDir, { recursive: true, force: true }) };
}
