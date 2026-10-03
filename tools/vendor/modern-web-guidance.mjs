// Copies Modern Web Guidance into .agents/skills/modern-web-guidance/, so the
// Developer reads it from the repo and nothing is downloaded in the room.
// For the template's maintainer, not for participants. To update the copy:
//
//   npm pack modern-web-guidance@latest
//   tar xzf modern-web-guidance-<version>.tgz
//   node tools/vendor/modern-web-guidance.mjs package
//
// The guides are copied unchanged. The upstream tool finds them by semantic
// search, which needs npx and a download; instead this writes index.md, one
// line per guide with upstream's own description, for the agent to read.
// SKILL.md in that folder is ours and is left alone.
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const packageDir = resolve(process.argv[2] ?? "package");
const upstreamSkill = join(packageDir, "skills", "modern-web-guidance");
const target = new URL("../../.agents/skills/modern-web-guidance/", import.meta.url);

const { version } = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
const skillVersion = (await readFile(join(upstreamSkill, "skill-version.txt"), "utf8")).trim();

// The search index holds several chunks per guide, each with the guide's
// id, category and description.
const chunks = JSON.parse(gunzipSync(await readFile(join(upstreamSkill, "use-cases.vectors.gen.json.gz"))));
const guides = new Map();
for (const { id, category, description, featuresUsed } of chunks) {
  if (!guides.has(id)) guides.set(id, { id, category, description, featuresUsed });
}
// A guide the search index leaves out still gets a line, described by its title.
const guidesDir = join(upstreamSkill, "guides");
for (const file of await readdir(guidesDir, { recursive: true })) {
  const id = basename(file, ".md");
  if (!file.endsWith(".md") || guides.has(id)) continue;
  const title = (await readFile(join(guidesDir, file), "utf8")).match(/^# (.+)$/m)?.[1] ?? id;
  guides.set(id, { id, category: basename(dirname(file)), description: `${title}.`, featuresUsed: [] });
}

const byCategory = Map.groupBy(
  [...guides.values()].sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id)),
  (guide) => guide.category,
);

const index = [
  "# Modern Web Guidance: index",
  "",
  `${guides.size} guides from modern-web-guidance ${version}, grouped by topic. Each line names the file to open and what the guide covers.`,
  "",
  ...[...byCategory].flatMap(([category, list]) => [
    `## ${category}`,
    "",
    ...list.map(({ id, description, featuresUsed }) => {
      const uses = featuresUsed.length ? ` Uses: ${featuresUsed.join(", ")}.` : "";
      return `- \`guides/${category}/${id}.md\`: ${description.trim()}${uses}`;
    }),
    "",
  ]),
].join("\n");

await rm(new URL("guides", target), { recursive: true, force: true });
await cp(guidesDir, new URL("guides", target), { recursive: true });
await cp(join(packageDir, "LICENSE"), new URL("LICENSE", target));
await writeFile(new URL("index.md", target), index);
await writeFile(
  new URL("NOTICE", target),
  `Modern Web Guidance
===================

The guides/ folder is a copy of the guides in modern-web-guidance ${version}
(skill version ${skillVersion}), published on npm by GoogleChrome:

    https://github.com/GoogleChrome/modern-web-guidance

Copyright the modern-web-guidance authors. Licensed under the Apache License,
Version 2.0; see LICENSE in this folder for the full terms. The package ships
no NOTICE file of its own; its THIRD_PARTY_NOTICES covers the JavaScript
libraries of its search tool, which are not copied here.

The guides are unmodified. index.md is generated from the package's own guide
descriptions by tools/vendor/modern-web-guidance.mjs. SKILL.md is written for
this template: it reads the guides from this folder instead of running the
upstream search tool, which needs npx and a download.
`,
);
console.log(`Copied ${guides.size} guides from modern-web-guidance ${version}.`);
