import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pageLabels, renderSections } from "../site/assets/render.js";
import { findPrivateDataInContent } from "../tools/check/private-data.mjs";
import { validateContent } from "../tools/check/schema.mjs";
import { buildFixtureSite } from "./fixture-site.js";
import { inChrome } from "./in-chrome.js";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const sample = JSON.parse(await read("../site/content.json"));
const schema = JSON.parse(await read("../site/content.schema.json"));
// The sample person with every widget and one project as a case study.
const widgets = JSON.parse(await read("./fixtures/clean-sites/all-widgets/content.json"));

// The day the tests are on, unless a test passes another one.
const TODAY = "2026-10-07";
const rendered = renderSections(widgets, { today: TODAY });

const WIDGETS = ["stats", "now", "events", "certifications", "courses"];

// The positions of these texts in the HTML, which must be in this order.
function assertInOrder(html, texts) {
  const positions = texts.map((text) => html.indexOf(text));
  assert.ok(positions.every((position) => position >= 0), `${texts.filter((text, index) => positions[index] < 0)} missing`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, texts.join(" | "));
}

test("the schema takes every widget and a project as a case study", () => {
  assert.deepEqual(validateContent(schema, widgets), []);
});

test("without its field, each widget has no section", () => {
  const sections = renderSections(sample, { today: TODAY });
  for (const widget of WIDGETS) assert.equal(sections[widget], "", widget);
  for (const widget of WIDGETS) assert.notEqual(rendered[widget], "", widget);
});

test("the schema names a wrong role, a session without a title, a fifth number and a fourth thing now", () => {
  const problems = (changes) => validateContent(schema, { ...widgets, ...changes }).join("\n");
  assert.match(problems({ events: [{ name: "X", date: "2026-10-10", role: "host" }] }), /events > 1 > role must be one of attendee, speaker, organizer, volunteer, mentor/);
  assert.match(problems({ events: [{ name: "X", date: "2026-10-10", role: "speaker", sessions: [{ type: "talk" }] }] }), /sessions > 1 is missing "title"/);
  assert.match(problems({ events: [{ name: "X", date: "10 October 2026", role: "speaker" }] }), /events > 1 > date has the wrong format/);
  assert.match(problems({ stats: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: "things" })) }), /stats may have at most 4 entries/);
  assert.match(problems({ now: { updated: "2026-10", items: ["a", "b", "c", "d"] } }), /now > items may have at most 3 entries/);
  assert.match(problems({ certifications: [{ name: "X", issuer: "Y", kind: "badge", issued: "2026-01" }] }), /kind must be one of exam, course, workshop/);
  // A number may be written as a number or as text, nothing else.
  assert.match(problems({ stats: [{ value: true, label: "things" }] }), /stats > 1 > value must be a string or a number/);
  assert.equal(problems({ stats: [{ value: 3, label: "things" }, { value: "100+", label: "more" }] }), "");
});

test("upcoming events come first as Up next, soonest first; past ones after, latest first", () => {
  assertInOrder(rendered.events, [
    "<h2>Events</h2>",
    '<h3>Up next</h3><ul class="events upcoming">',
    "DevFest Milano",
    "Example Conf",
    '<h3>Past events</h3><ul class="events past">',
    "Frontend Example Days",
    "Placeholder Meetup",
  ]);
});

test("upcoming and past split by the today passed to renderSections, on the day itself still up next", () => {
  const upNext = (today) => {
    const { events } = renderSections(widgets, { today });
    const upcoming = events.slice(0, events.indexOf("<h3>Past events</h3>"));
    return ["DevFest Milano", "Example Conf", "Frontend Example Days"].filter((name) => upcoming.includes(name));
  };
  assert.deepEqual(upNext("2025-10-18"), ["DevFest Milano", "Example Conf", "Frontend Example Days"]);
  assert.deepEqual(upNext("2026-10-10"), ["DevFest Milano", "Example Conf"]);
  assert.deepEqual(upNext("2026-10-11"), ["Example Conf"]);
  // Example Conf runs on 20 and 21 November.
  assert.deepEqual(upNext("2026-11-21"), ["Example Conf"]);
  assert.deepEqual(upNext("2026-11-22"), []);
  assert.ok(!renderSections(widgets, { today: "2026-11-22" }).events.includes("Up next"));
});

test("without a today, the split uses the current date", () => {
  const events = [
    { name: "Long Ago", date: "2000-01-01", role: "attendee" },
    { name: "Far Ahead", date: "2999-01-01", role: "attendee" },
  ];
  const html = renderSections({ ...sample, events }).events;
  assertInOrder(html, ["Up next", "Far Ahead", "Past events", "Long Ago"]);
});

test("each event shows an event badge with its name and role, and each session a session badge with its type and title", () => {
  const { events } = rendered;
  assert.ok(events.includes('<h4 class="event-badge">DevFest Milano <span class="role">Attendee</span></h4>'));
  assert.ok(events.includes('<span class="session-badge"><span class="type">Workshop</span> AI-Native Web Development, Hands-On</span>'));
  assert.ok(events.includes('<h4 class="event-badge"><a href="https://example.com/conf">Example Conf</a> <span class="role">Speaker</span></h4>'));
});

test("a speaker's events read as their talk list: each talk under its event, with its slides and video", () => {
  const { events } = rendered;
  assertInOrder(events, [
    "Example Conf",
    '<span class="type">Talk</span> <a href="https://example.com/conf/forms">Accessible Forms Without Tears</a>',
    '<a href="https://example.com/slides/forms">Slides</a>',
    '<a href="https://www.youtube.com/watch?v=EXAMPLE0004">Video</a>',
    "Frontend Example Days",
    '<span class="type">Talk</span> CSS That Holds Up',
    '<span class="type">Panel</span> The Future of Design Systems',
  ]);
});

// Intl puts thin or narrow spaces around the dash of a range, differently in
// Node and in Chrome; here every space is a plain one.
const plainSpaces = (html) => html.replace(/[\u00a0\u2009\u202f]/g, " ");

test("an event shows its date in the site's language and its city, or Online", () => {
  const events = plainSpaces(rendered.events);
  assert.ok(events.includes('<p class="period"><time datetime="2026-10-10">Oct 10, 2026</time> · Milan</p>'), events);
  assert.ok(events.includes('<p class="period"><time datetime="2026-11-20">Nov 20 – 21, 2026</time> · Turin</p>'), events);
  assert.ok(events.includes('<p class="period"><time datetime="2025-05">May 2025</time> · Online</p>'), events);
  const italian = renderSections({ ...widgets, language: "it" }, { today: TODAY }).events;
  assert.ok(italian.includes('<time datetime="2026-10-10">10 ott 2026</time>'), italian);
});

// The workshop as the Analyst adds it on the day of DevFest Milano.
const WORKSHOP = {
  name: "DevFest Milano",
  date: "2026-10-10",
  city: "Milan",
  role: "attendee",
  sessions: [{ type: "workshop", title: "AI-Native Web Development, Hands-On" }],
};

test("the workshop appears as one event with one session badge, never as a certification", () => {
  const sections = renderSections({ ...sample, events: [WORKSHOP] }, { today: "2026-10-10" });
  assert.equal(sections.events.match(/class="event"/g)?.length, 1);
  assert.equal(sections.events.match(/class="event-badge"/g)?.length, 1);
  assert.equal(sections.events.match(/class="session-badge"/g)?.length, 1);
  assert.equal(sections.certifications, "");
  assert.equal(sections.courses, "");
});

test("exam certifications show under Certifications with issuer, dates and verify link; expired ones are left out", () => {
  const { certifications } = rendered;
  assertInOrder(certifications, [
    "<h2>Certifications</h2>",
    "<h3>Example Certified Frontend Developer</h3>",
    '<p class="period">Example Academy · <time datetime="2026-03">Mar 2026</time> – <time datetime="2029-03">Mar 2029</time></p>',
    '<p class="credential-id">Credential ID EX-0000-0000</p>',
    '<p class="verify"><a href="https://example.com/verify/EX-0000-0000">Verify</a></p>',
  ]);
  for (const elsewhere of ["Example Cloud Associate", "Accessibility Fundamentals", "Design Systems Workshop"]) {
    assert.ok(!certifications.includes(elsewhere), elsewhere);
  }
});

test("courses and workshops show under Courses & workshops, latest first", () => {
  const { courses } = rendered;
  assertInOrder(courses, [
    "<h2>Courses &amp; workshops</h2>",
    "<h3>Accessibility Fundamentals</h3>",
    '<a href="https://example.com/certificate/0000">Verify</a>',
    "<h3>Design Systems Workshop</h3>",
    '<time datetime="2024-11-14">Nov 14, 2024</time>',
  ]);
  assert.ok(!courses.includes("Example Certified Frontend Developer"));
});

test("a certification that expires this month still shows; one with only expired entries has no section", () => {
  const expiring = [{ name: "Soon Over", issuer: "Example", kind: "exam", issued: "2023-10", expires: "2026-10" }];
  assert.ok(renderSections({ ...sample, certifications: expiring }, { today: TODAY }).certifications.includes("Soon Over"));
  assert.equal(renderSections({ ...sample, certifications: expiring }, { today: "2026-11-01" }).certifications, "");
});

test("Now shows when it was written and up to three things", () => {
  assert.equal(
    rendered.now,
    '<h2>Now</h2><p class="period">Updated <time datetime="2026-10">October 2026</time></p><ul class="now"><li>Building my portfolio with AI agents</li><li>Learning view transitions</li><li>Looking for a junior frontend role</li></ul>',
  );
  const four = { ...widgets.now, items: [...widgets.now.items, "A fourth thing"] };
  assert.ok(!renderSections({ ...sample, now: four }).now.includes("A fourth thing"));
});

test("the numbers show each value with its label, at most four", () => {
  assert.ok(rendered.stats.startsWith('<h2>In numbers</h2><ul class="stats">'));
  assert.ok(rendered.stats.includes('<li class="stat"><span class="stat-value">2</span> <span class="stat-label">projects shipped</span></li>'));
  assert.ok(rendered.stats.includes('<span class="stat-value">5</span> <span class="stat-label">years of teaching</span>'));
  const five = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `thing ${n}` }));
  assert.equal(renderSections({ ...sample, stats: five }).stats.match(/class="stat"/g).length, 4);
});

test("a project with case-study fields shows its picture, problem, role, outcome, stack and AI note", () => {
  const card = rendered.projects.slice(0, rendered.projects.indexOf("Reading Log"));
  assertInOrder(card, [
    "<h3>Tide Tables</h3>",
    '<img class="project-image" src="assets/tide-tables.svg" alt="Tide Tables: a blue curve of the tide over a day" loading="lazy" decoding="async">',
    "<p>A tiny web app",
    '<dl class="case-study">',
    "<dt>Problem</dt><dd>Sailors in a small harbour",
    "<dt>My role</dt><dd>I designed and built it alone",
    "<dt>Outcome</dt><dd>The harbour club links to it",
    "<dt>Stack</dt><dd>HTML, CSS and JavaScript",
    "<dt>With AI</dt><dd>An AI agent wrote the first chart code",
    '<p class="project-links">',
  ]);
});

test("a project with none of the case-study fields renders as it did before", () => {
  assert.equal(
    renderSections({ ...sample, projects: sample.projects.slice(0, 2) }).projects,
    '<h2>Projects</h2><ul class="projects">\n      <li class="project">\n        <h3>Tide Tables</h3>\n        <p>A tiny web app that shows today&#39;s tides for a chosen harbour, built with plain HTML, CSS and JavaScript.</p>\n        <p class="project-links">\n          <a href="https://github.com/octocat/Hello-World">Code on GitHub</a>\n          \n        </p>\n      </li>\n      <li class="project">\n        <h3>Reading Log</h3>\n        <p>A static site that lists the books I read, generated from one JSON file.</p>\n        <p class="project-links">\n          <a href="https://github.com/octocat/Spoon-Knife">Code on GitHub</a>\n          <a href="https://octocat.github.io/Spoon-Knife/">Live</a>\n        </p>\n      </li></ul>',
  );
});

test("the widgets' words come from labels, so a site in another language stays in it", () => {
  const labels = {
    stats: "In cifre", now: "Adesso", updated: "Aggiornato", events: "Eventi", upcoming: "Prossimi", past: "Passati",
    online: "Online", slides: "Slide", video: "Video", attendee: "Partecipante", speaker: "Relatrice", organizer: "Organizzatrice",
    volunteer: "Volontaria", mentor: "Mentore", talk: "Talk", workshop: "Workshop", keynote: "Keynote", panel: "Tavola rotonda",
    codelab: "Codelab", certifications: "Certificazioni", courses: "Corsi e workshop", verify: "Verifica",
    credentialId: "ID credenziale", problem: "Problema", role: "Il mio ruolo", outcome: "Risultato", stack: "Tecnologie", aiNote: "Con l'IA",
  };
  const page = Object.values(renderSections({ ...widgets, language: "it", labels }, { today: TODAY })).join("");
  for (const english of ["In numbers", ">Now<", "Updated", ">Events<", "Up next", "Past events", "Attendee", "Speaker", "Organizer", "Certifications", "Courses &amp;", ">Verify<", "Credential ID", "My role", "Outcome", "With AI"]) {
    assert.ok(!page.includes(english), english);
  }
  for (const italian of ["In cifre", "Aggiornato", "Prossimi", "Relatrice", "Tavola rotonda", "Corsi e workshop", "ID credenziale", "Con l&#39;IA"]) {
    assert.ok(page.includes(italian), italian);
  }
});

test("the widgets' values are escaped, never injected as markup", () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const page = Object.values(
    renderSections({
      ...sample,
      events: [{ name: hostile, date: "2026-10-10", city: hostile, url: 'https://e.com/"onclick="alert(1)', role: "speaker", sessions: [{ type: "talk", title: hostile, slides: 'https://e.com/"x="' }] }],
      certifications: [{ name: hostile, issuer: hostile, kind: "exam", issued: "2026-01", credentialId: hostile, url: 'https://e.com/"onclick="alert(1)' }],
      now: { updated: "2026-10", items: [hostile] },
      stats: [{ value: hostile, label: hostile }],
      projects: [{ ...sample.projects[0], problem: hostile, image: { src: 'assets/a.svg" onerror="alert(1)', alt: hostile } }],
    }, { today: TODAY }),
  ).join("");
  assert.ok(!page.includes("<img src=x"));
  assert.ok(!/"on\w+="/.test(page));
});

test("a credential ID with many digits is not taken for a phone number; a street as an event's city is named", () => {
  assert.deepEqual(findPrivateDataInContent({ ...widgets, certifications: [{ ...widgets.certifications[0], credentialId: "0000000000000" }] }), []);
  const street = { ...widgets.events[0], city: "Via Esempio, Placeholder Town" };
  assert.match(findPrivateDataInContent({ ...widgets, events: [street] }).join("\n"), /events > 1 > city: "Via Esempio, Placeholder Town" looks like a street/);
});

test("every class name the widgets write is documented for the Developer", async () => {
  const docs = (await read("../.agents/skills/build/SKILL.md")) + (await read("../.agents/skills/build/widgets.md"));
  const html = Object.values(rendered).join("");
  const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(([, names]) => names.split(" ")));
  for (const name of classes) assert.ok(docs.includes(`.${name}\``) || docs.includes(`.${name}.`), name);
});

const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));

test("in Chrome, each widget gets its place on the page: numbers and now under the first screen, events and certifications after the projects", async () => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "clean-sites/all-widgets");
  try {
    const headings = await inChrome(siteDir, `[...document.querySelectorAll("main > .section:not([hidden]) > h2")].map((h) => h.textContent.trim())`);
    // The page in Chrome is on the current date: a certification may have expired by now.
    const now = renderSections(widgets);
    const order = ["stats", "now", "projects", "events", "certifications", "courses", "links", "cv"].filter((id) => now[id] !== "");
    assert.deepEqual(headings, order.map((id) => now[id].match(/<h2>(.*?)<\/h2>/)[1].replaceAll("&amp;", "&")));
    assert.deepEqual(headings.slice(0, 4), ["In numbers", "Now", "Projects", "Events"]);
  } finally {
    await remove();
  }
});

// The skill portfolio-add-module adds a widget later, one recipe per widget:
// its question, an example of its entries, and its labels.
const moduleSkill = await read("../.agents/skills/portfolio-add-module/SKILL.md");
const recipeOf = (name) => moduleSkill.split(/^### /m).find((part) => part.startsWith(`${name}\n`));
const jsonBlocksIn = (section) => [...section.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => match[1]);

// Each widget's recipe, its key in the content file, and the sections it fills.
const RECIPES = {
  Events: { key: "events", sections: ["events"] },
  Certifications: { key: "certifications", sections: ["certifications", "courses"] },
  Now: { key: "now", sections: ["now"] },
  Numbers: { key: "stats", sections: ["stats"] },
  "Case study": { key: "projects", sections: ["projects"] },
};

// Every label the page has, marked, so the words a section writes can be found in it.
const marked = Object.fromEntries(Object.keys(pageLabels({})).map((name) => [name, `‹${name}›`]));
const markedSections = renderSections({ ...widgets, labels: marked }, { today: TODAY });
// The Analyst translates these for every site, with the projects.
const CORE = ["projects", "code", "live"];

for (const [name, { key, sections }] of Object.entries(RECIPES)) {
  test(`the ${name} recipe asks one question, and its example matches the schema and shows on the page`, () => {
    const recipe = recipeOf(name);
    assert.ok(recipe, name);
    assert.match(recipe, /^"[^"\n]+\?[^\n]*"$/m);
    const example = JSON.parse(`{${jsonBlocksIn(recipe)[0]}}`);
    assert.deepEqual(Object.keys(example), [key]);
    assert.deepEqual(validateContent(schema, { ...sample, ...example }), []);
    const shown = renderSections({ ...sample, ...example }, { today: TODAY });
    assert.ok(sections.some((section) => shown[section] !== renderSections(sample, { today: TODAY })[section]), name);
  });

  test(`the ${name} recipe's labels hold every word its widget writes`, () => {
    const labels = Object.keys(JSON.parse(`{${jsonBlocksIn(recipeOf(name)).find((block) => block.includes('"labels"'))}}`).labels);
    const written = new Set(sections.flatMap((section) => [...markedSections[section].matchAll(/‹(\w+)›/g)].map((match) => match[1])));
    for (const word of written) assert.ok(labels.includes(word) || CORE.includes(word), `${name} writes ${word}`);
    for (const label of labels) assert.ok(label in marked, label);
  });
}

test("a list written as something else by mistake leaves its part out, so the build still runs and the Check names it", () => {
  const slips = { highlights: "Fast pages", languages: { name: "English" }, stats: "3 projects", now: { updated: "2026-10", items: "Learning" }, events: { name: "Example Conf" }, certifications: "AWS" };
  const sections = renderSections({ ...sample, ...slips, events: [{ ...widgets.events[0], sessions: "a talk" }] }, { today: TODAY });
  assert.ok(sections.bio.includes(sample.name));
  assert.ok(!sections.bio.includes("highlights") && !sections.bio.includes('class="languages"'));
  for (const widget of ["stats", "now", "certifications", "courses"]) assert.equal(sections[widget], "", widget);
  assert.ok(sections.events.includes("DevFest Milano") && !sections.events.includes("sessions"));
  assert.ok(validateContent(schema, { ...sample, ...slips }).length >= Object.keys(slips).length);
});
