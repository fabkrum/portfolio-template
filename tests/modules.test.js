import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSections } from "../site/assets/render.js";
import { findPrivateDataInContent } from "../tools/check/private-data.mjs";
import { runCheck } from "../tools/check/run-check.mjs";
import { validateContent } from "../tools/check/schema.mjs";
import { findChrome, launchChrome, navigate, openTab } from "../tools/check/chrome.mjs";
import { serveSite } from "../tools/check/serve-site.mjs";
import { buildFixtureSite, sampleSite } from "./fixture-site.js";

const repoDir = fileURLToPath(new URL("..", import.meta.url));
const allModules = "tests/fixtures/clean-sites/all-optional-modules/content.json";

// The command the Optional-module skill runs after writing the entries.
const checkContent = (path) =>
  spawnSync(process.execPath, ["tools/check-content.mjs", path], { cwd: repoDir, encoding: "utf8" });

test("a content file with entries for all five Optional modules is ready", () => {
  assert.match(checkContent(allModules).stdout, /is ready/);
});

test("a video link that is not on YouTube is named, in plain words", () => {
  const { stdout } = checkContent("tests/fixtures/invalid-content/video-not-on-youtube.json");
  assert.match(stdout, /videos > 1 > url/);
});

test("a project idea without a description is named", () => {
  const { stdout } = checkContent("tests/fixtures/invalid-content/idea-without-description.json");
  assert.match(stdout, /ideas > 1 is missing "description"/);
});

const withModules = JSON.parse(await readFile(new URL(`../${allModules}`, import.meta.url), "utf8"));

// Each Optional module, its section's English heading, and the entries' key.
const MODULES = { videos: "Videos", podcasts: "Podcasts", posts: "Blog", resources: "Resources", ideas: "Project ideas" };

for (const [module, heading] of Object.entries(MODULES)) {
  test(`the ${module} section shows its heading and every entry from the content file`, () => {
    const html = renderSections(withModules)[module];
    assert.ok(html.includes(`<h2>${heading}</h2>`), heading);
    for (const entry of withModules[module]) {
      assert.ok(html.includes(entry.title), entry.title);
      if (entry.url) assert.ok(html.includes(`href="${entry.url}"`), entry.url);
      if (entry.description) assert.ok(html.includes(entry.description), entry.description);
    }
  });
}

test("a podcast shows its show, and a blog post its date", () => {
  const sections = renderSections(withModules);
  assert.ok(sections.podcasts.includes("The Example Podcast"));
  assert.ok(sections.posts.includes("2026-03-14"));
});

test("without entries, an Optional module has no section", async () => {
  const sample = JSON.parse(await readFile(new URL("../site/content.json", import.meta.url), "utf8"));
  const sections = renderSections(sample);
  for (const module of Object.keys(MODULES)) assert.equal(sections[module], "", module);
});

test("module entries are escaped, never injected as markup", () => {
  const hostile = { ...withModules, videos: [{ title: "<script>alert(1)</script>", url: "https://youtu.be/x\"onmouseover=\"alert(1)" }] };
  const { videos } = renderSections(hostile);
  assert.ok(!videos.includes("<script>"));
  assert.ok(!videos.includes('"onmouseover'));
});


test("a phone number in a module entry is named like anywhere else", async () => {
  const dir = await mkdtemp(join(tmpdir(), "modules-content-"));
  try {
    const path = join(dir, "content.json");
    const podcasts = [{ title: "Ask me anything", url: "https://podcasts.example.com/1", description: "Call in on +00 000 000 0000." }];
    await writeFile(path, JSON.stringify({ ...withModules, podcasts }));
    assert.match(checkContent(path).stdout, /"\+00 000 000 0000" looks like a phone number/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Evaluates an expression in the page Chrome shows for this site folder.
async function inChrome(siteDir, expression) {
  const server = await serveSite(siteDir);
  let chrome;
  try {
    chrome = await launchChrome(findChrome());
    const { sessionId } = await openTab(chrome.cdp);
    await navigate(chrome.cdp, sessionId, `${server.origin}/`);
    const { result } = await chrome.cdp.send("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
    return result.value;
  } finally {
    await chrome?.close();
    server.close();
  }
}

const VISIBLE_HEADINGS = `[...document.querySelectorAll("main > .section:not([hidden]) > h2")].map((h) => h.textContent.trim())`;

// The section headings the page shows in Chrome, in order, for the sample
// site with this content file and, if given, this index.html.
async function headingsInChrome(content, indexHtml) {
  const siteDir = await mkdtemp(join(tmpdir(), "modules-"));
  try {
    await cp(sampleSite, siteDir, { recursive: true });
    await writeFile(join(siteDir, "content.json"), JSON.stringify(content));
    if (indexHtml) await writeFile(join(siteDir, "index.html"), indexHtml);
    return await inChrome(siteDir, VISIBLE_HEADINGS);
  } finally {
    await rm(siteDir, { recursive: true, force: true });
  }
}

test("in Chrome, every Optional module with entries gets its section after the CV, with no change to index.html", async () => {
  assert.deepEqual(await headingsInChrome(withModules), ["Projects", "Find me", "CV", "Videos", "Podcasts", "Blog", "Resources", "Project ideas"]);
});

test("in Chrome, a module section the Developer placed in index.html stays where it is", async () => {
  const index = await readFile(join(sampleSite, "index.html"), "utf8");
  const placed = index.replace('<section id="links"', '<section id="videos" class="section"></section>\n      <section id="links"');
  assert.notEqual(placed, index);
  const { podcasts, posts, resources, ideas, ...onlyVideos } = withModules;
  assert.deepEqual(await headingsInChrome(onlyVideos, placed), ["Projects", "Videos", "Find me", "CV"]);
});

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const moduleSkill = () => read("../.agents/skills/portfolio-add-module/SKILL.md");

test("Antigravity finds the Optional-module skill in the workspace skills folder", async () => {
  const frontmatter = (await moduleSkill()).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  assert.match(frontmatter, /^name: portfolio-add-module$/m);
  assert.match(frontmatter, /^description: .*YouTube.*podcast.*blog.*resources.*project ideas.*$/im);
});

test("the skill has one recipe per Optional module, each with an example that matches the schema", async () => {
  const skill = await moduleSkill();
  const schema = JSON.parse(await read("../site/content.schema.json"));
  const sample = JSON.parse(await read("../site/content.json"));
  for (const [recipe, key] of [["YouTube", "videos"], ["Podcasts", "podcasts"], ["Blog", "posts"], ["Resources", "resources"], ["Project ideas", "ideas"]]) {
    const section = skill.split(/^### /m).find((part) => part.startsWith(`${recipe}\n`));
    assert.ok(section, recipe);
    const example = JSON.parse(`{${section.match(/```json\n([\s\S]*?)```/)[1]}}`);
    assert.deepEqual(Object.keys(example), [key], recipe);
    assert.deepEqual(validateContent(schema, { ...sample, ...example }), [], recipe);
  }
});

test("the skill writes only the content file, checks it, and runs the Check", async () => {
  const skill = await moduleSkill();
  for (const needed of ["You change only `site/content.json`", "node tools/check-content.mjs", "node tools/check.mjs", "Never embed"]) {
    assert.ok(skill.includes(needed), needed);
  }
});

// Proxy runs: a fresh agent on Claude Haiku 4.5 added one Optional module per
// run, with the person's side played turn by turn from answers.md. Each run
// folder holds what the agent told the person (report.md) and, in site/, the
// content file it wrote, laid over the site it started from. See
// fixtures/README.md.
const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const runContent = async (run) => JSON.parse(await read(`./fixtures/module-runs/${run}/site/content.json`));
const schema = JSON.parse(await read("../site/content.schema.json"));

// Each run, the content file it started from, and the module it added.
const RUNS = {
  youtube: { started: "../site/content.json", module: "videos" },
  podcasts: { started: "../site/content.json", module: "podcasts" },
  blog: { started: "../site/content.json", module: "posts" },
  resources: { started: "../site/content.json", module: "resources" },
  ideas: { started: "./fixtures/analyst-runs/cv/site/content.json", module: "ideas" },
};

// The messages of the person in report.md's Questions section that answer a
// question: every one after the agent's first message.
async function answersIn(run) {
  const report = await read(`./fixtures/module-runs/${run}/report.md`);
  const questions = report.split(/^## /m).find((section) => section.startsWith("Questions"));
  assert.ok(questions, "report.md has no Questions section");
  const turns = [...questions.matchAll(/^\*\*(Agent|Person):\*\*/gm)].map((match) => match[1]);
  return turns.slice(turns.indexOf("Agent")).filter((who) => who === "Person").length;
}

for (const [run, { started, module }] of Object.entries(RUNS)) {
  test(`${run} run: the content file matches the schema and has no phone number or postal address`, async () => {
    const content = await runContent(run);
    assert.deepEqual(validateContent(schema, content), []);
    assert.deepEqual(findPrivateDataInContent(content), []);
  });

  test(`${run} run: only the module's entries were added; everything else in the content file is unchanged`, async () => {
    const { [module]: added, labels: newLabels, ...rest } = await runContent(run);
    const { labels: oldLabels, ...before } = JSON.parse(await read(started));
    assert.ok(added?.length > 0, `no ${module}`);
    assert.deepEqual(rest, before);
    const { [module]: moduleLabel, ...keptLabels } = newLabels ?? {};
    assert.deepEqual(keptLabels, oldLabels ?? {});
  });

  test(`${run} run: at most two questions, one for the module and one for its entries`, async () => {
    const answers = await answersIn(run);
    assert.ok(answers >= 1 && answers <= 2, `${answers} answers`);
  });

  test(`${run} run: in Chrome, the new section comes last and shows every entry's title and link`, async () => {
    const content = await runContent(run);
    const { siteDir, remove } = await buildFixtureSite(fixturesDir, `module-runs/${run}/site`);
    try {
      const shown = await inChrome(siteDir, `(() => {
        const section = document.getElementById(${JSON.stringify(module)});
        return {
          last: [...document.querySelectorAll("main > .section:not([hidden])")].at(-1)?.id,
          heading: section.querySelector("h2")?.textContent.trim(),
          titles: [...section.querySelectorAll("li h3")].map((h) => h.textContent.trim()),
          links: [...section.querySelectorAll("li h3 a")].map((a) => a.getAttribute("href")),
        };
      })()`);
      assert.deepEqual(shown, {
        last: module,
        heading: content.labels?.[module] ?? MODULES[module],
        titles: content[module].map((entry) => entry.title),
        links: content[module].filter((entry) => entry.url).map((entry) => entry.url),
      });
    } finally {
      await remove();
    }
  });

  test(`${run} run: laid over the site it started from, every item of the Check passes but the Lawyer's privacy page`, async () => {
    const { siteDir, remove } = await buildFixtureSite(fixturesDir, `module-runs/${run}/site`);
    try {
      for (const item of await runCheck(siteDir)) assert.equal(item.pass, item.id !== "privacy", `${item.id}: ${item.details}`);
    } finally {
      await remove();
    }
  });
}

test("YouTube run: all three videos, as links on YouTube, the http one as https, none embedded", async () => {
  const { videos } = await runContent("youtube");
  assert.deepEqual(videos.map((video) => video.url), [
    "https://www.youtube.com/watch?v=EXAMPLE0001",
    "https://www.youtube.com/watch?v=EXAMPLE0002",
    "https://youtu.be/EXAMPLE0003",
  ]);
});

test("podcasts run: both episodes with their shows, the call-in phone number left out", async () => {
  const { podcasts } = await runContent("podcasts");
  assert.deepEqual(podcasts.map((episode) => episode.show), ["The Example Podcast", "Placeholder Radio"]);
  assert.ok(!JSON.stringify(podcasts).includes("000 000 0000"));
});

test("blog run: three posts, dates as year-month-day, the one without a date left without", async () => {
  const { posts } = await runContent("blog");
  assert.deepEqual(posts.map((post) => post.date), ["2026-03-14", "2026-05-02", undefined]);
});

test("resources run: three links, the http one as https", async () => {
  const { resources } = await runContent("resources");
  assert.deepEqual(resources.map((resource) => resource.url), ["https://developer.mozilla.org/", "https://web.dev/", "https://www.a11yproject.com/"]);
});

test("project ideas run: on the Italian site, the ideas and their heading are in Italian", async () => {
  const { ideas, labels } = await runContent("ideas");
  assert.equal(ideas.length, 2);
  assert.ok(labels.ideas && labels.ideas !== "Project ideas", labels.ideas);
  assert.ok(!ideas.some((idea) => /timetable|translator/i.test(idea.title)), ideas.map((idea) => idea.title).join(", "));
  assert.equal(ideas[1].url, "https://github.com/octocat/Hello-World/issues");
});
