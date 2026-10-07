// A participant's repo: the template as it lands on their laptop. No .git, as
// after the Install script's ZIP download, and no tests. "own" lays files of
// their own over it: { "site/content.json": "tests/fixtures/…", … }.
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const templateDir = fileURLToPath(new URL("..", import.meta.url));

export async function participantRepo(own = {}) {
  const dir = await mkdtemp(join(tmpdir(), "participant-"));
  const skip = new Set([".git", "tests", "qa", "_site", "node_modules"]);
  await cp(templateDir, dir, {
    recursive: true,
    filter: (source) => !skip.has(relative(templateDir, source).split(sep)[0]),
  });
  for (const [file, from] of Object.entries(own)) await cp(join(templateDir, from), join(dir, file));
  return { dir, remove: () => rm(dir, { recursive: true, force: true }) };
}

// Runs use(dir) on a fresh participant's repo, and removes it afterwards.
export async function withRepo(...args) {
  const use = args.pop();
  const { dir, remove } = await participantRepo(...args);
  try {
    return await use(dir);
  } finally {
    await remove();
  }
}
