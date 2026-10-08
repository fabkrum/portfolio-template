import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { TOKENS } from "../tools/brief/check-brief.mjs";
import { buildSite } from "../tools/build/build-site.mjs";
import { isPlaceholderPage, runCheck } from "../tools/check/run-check.mjs";
import { LEGAL_NOTICE_LINES, legalBlanks, NO_KNOWN_BARRIERS, PHOTO_SECTION, TEMPLATE_PATH } from "../tools/legal/write-legal-page.mjs";
import { buildFixtureSite } from "./fixture-site.js";
import { templateDir, withRepo } from "./participant-repo.js";
import { assertWideLayout } from "./page-layout.js";
import { lightDarkTokens, loadsFromElsewhere } from "./site-files.js";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const readText = async (path) => (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
const frontmatter = (skill) => skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
const qaSkill = () => read("../.agents/skills/qa/SKILL.md");
const legalSkill = () => read("../.agents/skills/legal/SKILL.md");
const privacyTemplate = () => readText(TEMPLATE_PATH);

// The commands in a skill: its fenced blocks with no language, such as json.
const commandsIn = (text) =>
  [...text.matchAll(/^ *```(\w*)\n([\s\S]*?)^ *```$/gm)].filter((match) => !match[1]).map((match) => match[2].trim());

test("Antigravity finds the QA skill in the workspace skills folder", async () => {
  const meta = frontmatter(await qaSkill());
  assert.match(meta, /^name: qa$/m);
  assert.match(meta, /^description: .*QA.*legal page.*$/m);
});

test("QA looks at the page before it trusts the Check, and looks again after fixing", async () => {
  const skill = await qaSkill();
  for (const needed of ["node tools/look.mjs", "node tools/check.mjs", "design/brief.md", "Largest Contentful Paint", "Cumulative Layout Shift"]) {
    assert.ok(skill.includes(needed), needed);
  }
  // Chrome DevTools for agents when Antigravity has it: Lighthouse and a performance trace.
  assert.match(skill, /lighthouse_audit/);
  assert.match(skill, /performance_start_trace/);
  // Antigravity asks before each of these tools runs: the person reads what it wants to do, then allows it.
  assert.match(skill, /Antigravity asks/);
  assert.match(skill, /Read what it wants to do/);
  assert.match(skill, /allow it/);
  // Looking comes first; the Check alone cannot see the layout.
  assert.ok(skill.indexOf("node tools/look.mjs") < skill.indexOf("node tools/check.mjs"));
  // It looks again after fixing: the look command is named more than once.
  assert.ok(skill.split("node tools/look.mjs").length > 2, "QA never looks again after fixing");
});

// The legal page is written by the Developer's node tools/legal.mjs; QA checks it.
test("QA checks the legal page: the Check's item, the four privacy screenshots, and the legal notice read back digit by digit", async () => {
  const skill = await qaSkill();
  for (const needed of [
    '"Legal page written"',
    "`privacy-*` screenshots",
    "same look as the home page",
    "node tools/legal.mjs",
    "read a phone number in it back digit by digit",
    "name it for the Analyst, in a fresh chat",
    '"QA is done. Start a fresh chat and ask for Ops: it publishes your site on GitHub Pages."',
    "Do not publish in this chat.",
  ]) {
    assert.ok(skill.includes(needed), needed);
  }
  assert.doesNotMatch(skill, /Lawyer/);
  // QA still changes only the site's files, never the content file or the brief.
  assert.match(skill, /You change only files in `site\/`, and never `site\/content\.json` or `design\/brief\.md`/);
});

test("Antigravity finds the legal skill, a helper for changing the legal page later, not a Role", async () => {
  const meta = frontmatter(await legalSkill());
  assert.match(meta, /^name: legal$/m);
  const description = meta.match(/^description: (.*)$/m)?.[1] ?? "";
  for (const needed of ["Changes the legal page later", "postal address", "VAT number", "phone number", "translates the page", "accessibility statement", "Impressum", "Note legali", "Partita IVA", "privacy notice"]) {
    assert.ok(description.includes(needed), needed);
  }
  assert.doesNotMatch(description, /role/i);
  const skill = await legalSkill();
  assert.doesNotMatch(skill, /Lawyer|starts in a fresh chat|You are the/);
});

test("the legal skill writes the content file, runs node tools/legal.mjs, translates if needed, runs the Check and reads back", async () => {
  const skill = await legalSkill();
  assert.deepEqual(commandsIn(skill), ["node tools/check-content.mjs", "node tools/legal.mjs", "node tools/check.mjs", "node tools/look.mjs", "node tools/preview.mjs"]);
  for (const needed of [
    "`legal.address`",
    "`legal.vatId`",
    "a `tel:` address",
    "Count the digits",
    "What the site shows is the person's choice",
    "`legal-notice`, `privacy` and `accessibility`",
    '"Note legali"',
    '"Partita IVA"',
    '"Impressum"',
    "Never hide a barrier",
    "digit by digit",
    "not legal advice",
    '"Your legal page is updated. To publish it, start a fresh chat and ask for Ops."',
  ]) {
    assert.ok(skill.includes(needed), needed);
  }
  assert.match(skill, /You change only `site\/privacy\.html` and, in `site\/content\.json`, the `legal` part and a `tel:` link in `links`/);
});

test("the legal page template has the nine blanks the tool fills, and no copy of it is left in the skill", async () => {
  const blanks = [...new Set((await privacyTemplate()).match(/\[\[[A-Z_]+\]\]/g))];
  assert.deepEqual(blanks.sort(), ["[[ADDRESS]]", "[[BARRIERS]]", "[[DATE]]", "[[EMAIL]]", "[[LANGUAGE]]", "[[NAME]]", "[[PHONE]]", "[[PHOTO]]", "[[VAT]]"]);
  assert.equal(relative(templateDir, TEMPLATE_PATH).replaceAll("\\", "/"), "tools/legal/privacy-template.html");
  assert.equal(existsSync(join(templateDir, ".agents", "skills", "legal", "privacy-template.html")), false);
});

test("the legal notice's lines and the sentence about barriers are word for word what the tool writes", () => {
  assert.equal(LEGAL_NOTICE_LINES.ADDRESS("…"), "<p>Address: …</p>");
  assert.equal(LEGAL_NOTICE_LINES.PHONE("tel:…"), '<p>Phone: <a href="tel:…">…</a></p>');
  assert.equal(LEGAL_NOTICE_LINES.VAT("…"), "<p>VAT number: …</p>");
  assert.equal(NO_KNOWN_BARRIERS, "No barriers are known. Automatic tests cannot find every barrier, so if you meet one, please tell me.");
  assert.match(PHOTO_SECTION, /<h2>My photo<\/h2>/);
  assert.match(PHOTO_SECTION, /none of the hidden data a phone saves in a photo/);
});

test("the legal page template covers what an EU portfolio without tracking must say, and has its three parts", async () => {
  const page = await privacyTemplate();
  for (const needed of [
    'id="legal-notice"',
    'id="privacy"',
    'id="accessibility"',
    "GDPR",
    "no cookies",
    "no analytics and no tracking",
    "GitHub Pages",
    "IP address",
    "Article 6(1)(f) GDPR",
    "EU-U.S. Data Privacy Framework",
    "Article 77 GDPR",
    "Web Content Accessibility Guidelines (WCAG) 2.2 at level AA",
    "axe",
    "Found a barrier?",
    'href="./"',
    'href="assets/styles.css"',
  ]) {
    assert.ok(page.includes(needed), needed);
  }
});

// The one command, run the way the Developer runs it: from the repo folder.
const legalIn = (dir) => spawnSync(process.execPath, [join(dir, "tools", "legal.mjs")], { cwd: dir, encoding: "utf8" });
const checkIn = (dir) => spawnSync(process.execPath, [join(dir, "tools", "check.mjs")], { cwd: dir, encoding: "utf8" });
const checkOf = async (dir) => Object.fromEntries((await runCheck(join(dir, "site"))).map((item) => [item.id, item]));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

test("node tools/legal.mjs writes the legal page for the sample person, dated today, says so in one line, and the Check passes every item", async () => {
  await withRepo(async (dir) => {
    assert.ok(isPlaceholderPage(await readText(join(dir, "site", "privacy.html"))), "the template ships the placeholder");
    const { status, stdout, stderr } = legalIn(dir);
    assert.equal(status, 0, stdout + stderr);
    assert.equal(stdout, "Your legal page is ready: site/privacy.html, with the legal notice for Ada Example (ada@example.com), the privacy notice and the accessibility statement.\n");
    const page = await readText(join(dir, "site", "privacy.html"));
    const today = new Date();
    const date = page.match(/Last updated: (\d{1,2}) (\w+) (\d{4})</);
    assert.ok(date, "no date");
    assert.deepEqual([Number(date[1]), date[2], Number(date[3])], [today.getDate(), MONTHS[today.getMonth()], today.getFullYear()]);
    // Word for word the finished page of the fixtures, but for the day.
    const finished = await readText(join(templateDir, "tests", "fixtures", "finished-privacy", "privacy.html"));
    assert.equal(page.replace(date[0], "Last updated: 4 October 2026<"), finished);
    assert.doesNotMatch(page, /\[\[/);
    for (const item of Object.values(await checkOf(dir))) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
    assert.match(checkIn(dir).stdout, /5 of 5 items pass\./);
  });
});

test("node tools/legal.mjs fills every blank: the name, the email address, the language and the photo section for a person with a photo", async () => {
  await withRepo(async (dir) => {
    assert.equal(legalIn(dir).status, 0);
    const page = await readText(join(dir, "site", "privacy.html"));
    for (const needed of [
      '<html lang="en">',
      "<title>Legal notice &amp; privacy · Ada Example</title>",
      "This website is run by Ada Example.",
      "personal portfolio of Ada Example",
      '<a href="mailto:ada@example.com">ada@example.com</a>',
      "<h2>My photo</h2>",
      NO_KNOWN_BARRIERS,
    ]) {
      assert.ok(page.includes(needed), needed);
    }
    // [[EMAIL]] appears six times in the template: all of them filled.
    assert.equal(page.match(/ada@example\.com/g).length, 6);
    assert.doesNotMatch(page, /Address:|Phone:|VAT number:/);
  });
});

test("node tools/legal.mjs writes the legal notice's address, phone and VAT lines from the content file, and the phone link calls the number it shows", async () => {
  await withRepo({ "site/content.json": "tests/fixtures/clean-sites/contact-details-shown/content.json" }, async (dir) => {
    const given = await readText(join(dir, "site", "content.json"));
    const { status, stdout } = legalIn(dir);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /legal notice for Ada Example \(ada@example\.com\)/);
    assert.equal(await readText(join(dir, "site", "content.json")), given, "the content file is left as it is");
    const page = await readText(join(dir, "site", "privacy.html"));
    const notice = page.slice(page.indexOf('id="legal-notice"'), page.indexOf('id="privacy"'));
    for (const line of [
      "<p>This website is run by Ada Example.</p>",
      "<p>Address: Via Esempio 1, 20100 Milano, Italy</p>",
      '<p>Email: <a href="mailto:ada@example.com">ada@example.com</a></p>',
      '<p>Phone: <a href="tel:+390000000000">+390000000000</a></p>',
      "<p>VAT number: IT00000000000</p>",
    ]) {
      assert.ok(notice.includes(line), line);
    }
    assert.doesNotMatch(page, /\[\[/);
    for (const item of Object.values(await checkOf(dir))) assert.equal(item.pass, true, `${item.id}: ${item.details}`);
    assert.deepEqual(await loadsFromElsewhere(join(dir, "site")), []);
  });
});

test("for a person without a photo, on a site that is not in English, the page is in English, without the photo section", async () => {
  await withRepo({ "site/content.json": "tests/fixtures/analyst-runs/cv/site/content.json" }, async (dir) => {
    const { status, stdout } = legalIn(dir);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /legal notice for Giulia Placeholder \(giulia@example\.com\)/);
    const page = await readText(join(dir, "site", "privacy.html"));
    assert.ok(page.includes('<html lang="en">'), "English, whatever the site's language");
    assert.ok(page.includes("personal portfolio of Giulia Placeholder"));
    assert.ok(!page.includes("Ada Example"));
    assert.ok(!page.includes("My photo"), "Giulia has no photo");
    assert.ok(!page.includes("[[PHOTO]]"));
    // Without the section the page is the template's, blank line for blank line.
    assert.match(page, /<\/section>\n\n {6}<section class="section">\n {8}<h2>Hosting on GitHub Pages<\/h2>/);
    assert.equal((await checkOf(dir)).legal.pass, true);
  });
});

test("without an email address in the content file, node tools/legal.mjs still writes the page, keeps that blank, says what to do, and fails", async () => {
  await withRepo(async (dir) => {
    const content = JSON.parse(await readFile(join(dir, "site", "content.json"), "utf8"));
    content.links = content.links.filter((link) => !link.url.startsWith("mailto:"));
    delete content.availability;
    await writeFile(join(dir, "site", "content.json"), JSON.stringify(content, null, 2));
    const { status, stdout } = legalIn(dir);
    assert.equal(status, 1);
    assert.ok(
      stdout.endsWith(
        "site/content.json has no email address, so the legal notice has a blank: the law asks for a way to reach whoever runs the site. Add one as a mailto: link in links (the Analyst does it), then run this again.\n",
      ),
      stdout,
    );
    const page = await readText(join(dir, "site", "privacy.html"));
    assert.ok(!isPlaceholderPage(page), "the page is written");
    assert.ok(page.includes("This website is run by Ada Example."));
    assert.ok(page.includes("[[EMAIL]]"));
    assert.match((await checkOf(dir)).legal.details.join("\n"), /\[\[EMAIL\]\]/);
  });
});

test("with a content file that is not valid JSON, node tools/legal.mjs writes nothing and says who fixes it", async () => {
  await withRepo(async (dir) => {
    await writeFile(join(dir, "site", "content.json"), '{ "name": "Ada Example", ');
    const { status, stdout } = legalIn(dir);
    assert.equal(status, 1);
    assert.match(stdout, /site\/content\.json is not valid JSON/);
    assert.match(stdout, /the Analyst's to fix, in a fresh chat/);
    assert.ok(isPlaceholderPage(await readText(join(dir, "site", "privacy.html"))), "the placeholder stays");
  });
});

test("run again for another person, node tools/legal.mjs writes the page again for them", async () => {
  await withRepo(async (dir) => {
    assert.equal(legalIn(dir).status, 0);
    await writeFile(join(dir, "site", "content.json"), await readFile(join(templateDir, "tests", "fixtures", "analyst-runs", "cv", "site", "content.json")));
    assert.equal(legalIn(dir).status, 0);
    const page = await readText(join(dir, "site", "privacy.html"));
    assert.ok(page.includes("personal portfolio of Giulia Placeholder"));
    assert.ok(!page.includes("Ada Example"));
  });
});

test("the blanks come from the content file alone: a tel: link, legal.address and legal.vatId, with nothing invented", () => {
  const blanks = legalBlanks({ name: "Ada Example", language: "it", links: [{ label: "Email", url: "mailto:ada@example.com?subject=Hi" }, { label: "Phone", url: "tel:+390000000000" }], legal: { address: "Via Esempio 1", vatId: "IT00000000000" } }, new Date(2026, 9, 4));
  assert.deepEqual(blanks, {
    NAME: "Ada Example",
    EMAIL: "ada@example.com",
    LANGUAGE: "en",
    DATE: "4 October 2026",
    BARRIERS: NO_KNOWN_BARRIERS,
    photo: false,
    address: "Via Esempio 1",
    phone: "tel:+390000000000",
    vat: "IT00000000000",
  });
  const none = legalBlanks({ name: " ", links: "not a list", legal: { address: "" } });
  assert.equal(none.NAME, undefined);
  assert.equal(none.EMAIL, undefined);
  assert.equal(none.address, undefined);
  assert.equal(none.vat, undefined);
  assert.equal(none.phone, undefined);
});

test("with a VAT number in the content file, the home page's footer shows it", async () => {
  const { siteDir, remove } = await buildFixtureSite(fileURLToPath(new URL("./fixtures", import.meta.url)), "clean-sites/contact-details-shown");
  const outDir = await mkdtemp(join(tmpdir(), "legal-built-"));
  try {
    await buildSite(siteDir, outDir, { today: "2026-10-08" });
    const home = await readFile(join(outDir, "index.html"), "utf8");
    assert.match(home, /<footer>[\s\S]*<span class="vat">VAT number IT00000000000<\/span>[\s\S]*<\/footer>/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
    await remove();
  }
});

// Proxy runs: a fresh agent on Claude Haiku 4.5 played QA on a site with
// planted problems. "before" is the site it was given, "after" holds the
// files it changed. See fixtures/README.md.
const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const checkOfFixture = async (name) => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, name);
  try {
    return Object.fromEntries((await runCheck(siteDir)).map((item) => [item.id, item]));
  } finally {
    await remove();
  }
};
const filesIn = async (name) =>
  (await readdir(join(fixturesDir, name), { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name !== "fixture.json")
    .map((entry) => relative(join(fixturesDir, name), join(entry.parentPath, entry.name)).replaceAll("\\", "/"));

test("QA was given a site with faint dates and the project heading in a column of its own", async () => {
  const items = await checkOfFixture("qa-runs/before");
  assert.equal(items.accessibility.pass, false);
  assert.match(items.accessibility.details.join("\n"), /contrast.*\.period/);
  await assert.rejects(assertWideLayout(fixturesDir, "qa-runs/before"));
});

// The run is from before node tools/legal.mjs: its legal page is still the placeholder.
test("after QA, the site passes the Check's accessibility item and every other item but the legal page", async () => {
  const items = await checkOfFixture("qa-runs/after");
  for (const item of Object.values(items)) assert.equal(item.pass, item.id !== "legal", `${item.id}: ${item.details}`);
});

test("after QA, the project cards sit side by side and the sections apart", async () => {
  await assertWideLayout(fixturesDir, "qa-runs/after");
});

test("QA changed only the site's code, kept the brief's six colours and loads nothing from elsewhere", async () => {
  const changed = await filesIn("qa-runs/after");
  assert.ok(changed.length > 0, "QA changed nothing");
  for (const file of changed) assert.ok(!["content.json", "privacy.html"].includes(file), file);
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "qa-runs/after");
  try {
    const before = lightDarkTokens(await readFile(join(fixturesDir, "built-sites/default-brief/assets/styles.css"), "utf8"));
    const after = lightDarkTokens(await readFile(join(siteDir, "assets", "styles.css"), "utf8"));
    for (const token of TOKENS) assert.deepEqual(after[token], before[token], `--${token}`);
    assert.deepEqual(await loadsFromElsewhere(siteDir), []);
  } finally {
    await remove();
  }
});
