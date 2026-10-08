import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSections } from "../site/assets/render.js";
import { validateContent } from "../tools/check/schema.mjs";
import { buildFixtureSite } from "./fixture-site.js";
import { inChrome } from "./in-chrome.js";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const sample = JSON.parse(await read("../site/content.json"));
const schema = JSON.parse(await read("../site/content.schema.json"));

// The sample person without any of the fields of the first screen.
const { photo, pitch, highlights, availability, location, languages, ...plain } = sample;

// The sample person was built at no event. The event of a site built at a
// workshop, as the Analyst takes it from workshop.json, comes from a fixture:
// the sample person with every widget and the workshop.
const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const atAWorkshop = JSON.parse(await read("./fixtures/clean-sites/all-widgets/content.json"));
const { builtAt } = atAWorkshop;

const problemsWith = (changes) => validateContent(schema, { ...sample, ...changes }).join("\n");

test("the schema takes the sample person's photo, pitch, highlights, availability, location and languages, and the event of a workshop", () => {
  assert.ok(photo && pitch && highlights && availability && location && languages, "the sample has every field of the first screen");
  assert.ok(builtAt, "the fixture has the event");
  assert.deepEqual(validateContent(schema, sample), []);
  assert.deepEqual(validateContent(schema, plain), []);
  assert.deepEqual(validateContent(schema, { ...sample, builtAt }), []);
});

test("a photo without alt text is named, in plain words", () => {
  assert.match(problemsWith({ photo: { src: "assets/photo.webp" } }), /photo is missing "alt"/);
  assert.match(problemsWith({ photo: { src: "assets/photo.webp", alt: "" } }), /photo > alt must not be empty/);
});

test("a photo must be a picture in the site's own assets folder, never one from another server", () => {
  assert.match(problemsWith({ photo: { src: "https://example.com/me.jpg", alt: "Me" } }), /photo > src has the wrong format/);
  assert.match(problemsWith({ photo: { src: "assets/me.heic", alt: "Me" } }), /photo > src has the wrong format/);
  assert.equal(problemsWith({ photo: { src: "assets/photo.webp", alt: "Me" } }), "");
});

// The location is the city the person is based in; a postal address, for the
// legal notice, goes into legal.address.
test("the location takes a city, not a street address", () => {
  assert.match(problemsWith({ location: { city: "Via Esempio 0, 00000 Nowhere" } }), /location > city has the wrong format.*city or a country/);
  assert.match(problemsWith({ location: { city: "Milan", street: "Via Esempio" } }), /"street" is not allowed in location/);
});

test("the action takes https://, mailto: and tel: links, and nothing else", () => {
  const action = (actionUrl) => problemsWith({ availability: { text: "Available.", actionLabel: "Call me", actionUrl } });
  assert.equal(action("tel:0000000000"), "");
  assert.match(action("http://cal.example.com/ada"), /availability > actionUrl has the wrong format/);
  assert.equal(action("mailto:ada@example.com"), "");
  assert.equal(action("https://cal.example.com/ada"), "");
});

test("an action needs both its text and its link", () => {
  assert.match(problemsWith({ availability: { text: "Available.", actionUrl: "mailto:ada@example.com" } }), /availability has "actionUrl", so it also needs "actionLabel"/);
  assert.match(problemsWith({ availability: { text: "Available.", actionLabel: "Write to me" } }), /availability has "actionLabel", so it also needs "actionUrl"/);
});

test("a pitch longer than 160 characters, a fourth highlight and an unknown language level are named", () => {
  assert.match(problemsWith({ pitch: "a".repeat(161) }), /pitch is too long: at most 160 characters, it has 161/);
  assert.match(problemsWith({ highlights: [1, 2, 3, 4].map((n) => ({ text: `Point ${n}` })) }), /highlights may have at most 3 entries; it has 4/);
  assert.match(problemsWith({ languages: [{ name: "English", level: "fluent" }] }), /languages > 1 > level must be one of A1, A2, B1, B2, C1, C2, native, not "fluent"/);
});

// The first <img> of a piece of HTML, as { attribute: value }.
const firstImage = (html) =>
  Object.fromEntries([...(html.match(/<img\b[^>]*>/)?.[0] ?? "").matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));

test("the photo comes first, with its size set, loaded early and never lazily", () => {
  const { bio } = renderSections(sample);
  const image = firstImage(bio);
  assert.equal(image.class, "photo");
  assert.equal(image.src, photo.src);
  assert.equal(image.alt, photo.alt.replace("'", "&#39;"));
  assert.ok(Number(image.width) > 0 && image.width === image.height, `${image.width} × ${image.height}`);
  assert.equal(image.fetchpriority, "high");
  assert.equal(image.decoding, "async");
  assert.equal(image.loading, undefined);
  assert.ok(bio.indexOf("<img") < bio.indexOf("<h1>"));
});

test("a photo without alt text is left out of the page", () => {
  assert.doesNotMatch(renderSections({ ...sample, photo: { src: "assets/photo.webp" } }).bio, /<img/);
  assert.doesNotMatch(renderSections({ ...sample, photo: { src: "assets/photo.webp", alt: " " } }).bio, /<img/);
});

test("the hero shows the pitch, each highlight with its proof link, and availability with its action", () => {
  const { bio } = renderSections(sample);
  assert.ok(bio.includes(`<p class="pitch">${pitch}</p>`));
  assert.match(bio, /<ul class="highlights">/);
  for (const highlight of highlights) {
    assert.ok(bio.includes(highlight.url ? `<a href="${highlight.url}">${highlight.text}</a>` : highlight.text), highlight.text);
  }
  assert.ok(bio.includes(`<p class="availability">${availability.text} <a href="${availability.actionUrl}">${availability.actionLabel}</a></p>`));
  // Name and headline first, then pitch, highlights, availability, the facts and the bio.
  const order = ["<h1>", 'class="headline"', 'class="pitch"', 'class="highlights"', 'class="availability"', 'class="facts"', sample.bio[0]];
  const positions = order.map((part) => bio.indexOf(part));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, JSON.stringify(positions));
});

test("city, time zone and languages show as small facts, written in the site's language", () => {
  const { bio } = renderSections(sample);
  assert.match(bio, /<ul class="facts">/);
  assert.ok(bio.includes('<li class="location"><span class="fact-label">Based in</span> Milan, Italy (Central European Time)</li>'));
  assert.ok(bio.includes('<li class="languages"><span class="fact-label">Speaks</span> English (native) and Italian (B2)</li>'));
  const italian = renderSections({
    ...sample,
    language: "it",
    location: { city: "Milano", timeZone: "Europe/Rome" },
    languages: [{ name: "italiano", level: "native" }, { name: "inglese", level: "C1" }],
    labels: { basedIn: "Vivo a", speaks: "Parlo", native: "madrelingua" },
  }).bio;
  assert.ok(italian.includes("Vivo a</span> Milano (Ora dell’Europa centrale)"), italian);
  assert.ok(italian.includes("Parlo</span> italiano (madrelingua) e inglese (C1)"), italian);
});

test("a city without a time zone, or one whose time zone is unknown, shows the city alone", () => {
  assert.ok(renderSections({ ...sample, location: { city: "Milan" } }).bio.includes("Based in</span> Milan</li>"));
  assert.ok(renderSections({ ...sample, location: { city: "Milan", timeZone: "Mars/Olympus" } }).bio.includes("Based in</span> Milan</li>"));
});

test("without the new fields, the hero is name, headline and bio, as before", () => {
  const { bio } = renderSections(plain);
  for (const part of ["<img", "pitch", "highlights", "availability", "facts"]) assert.ok(!bio.includes(part), part);
  assert.equal(renderSections(plain).colophon, "");
});

test("each field of the first screen is left out on its own when it is missing", () => {
  for (const [field, part] of Object.entries({ photo: "<img", pitch: 'class="pitch"', highlights: 'class="highlights"', availability: 'class="availability"' })) {
    const { [field]: _, ...without } = sample;
    const { bio } = renderSections(without);
    assert.ok(!bio.includes(part), field);
    assert.ok(bio.includes(sample.name), field);
  }
  const { location: _, languages: __, ...noFacts } = sample;
  assert.ok(!renderSections(noFacts).bio.includes("facts"));
  assert.ok(!renderSections({ ...sample, location: undefined }).bio.includes("location"));
  assert.ok(renderSections({ ...sample, location: undefined }).bio.includes('class="languages"'));
  const noAction = renderSections({ ...sample, availability: { text: "Available." } }).bio;
  assert.ok(noAction.includes('<p class="availability">Available.</p>'));
});

test("the colophon line names the event and says the site has no trackers and serves its own fonts; the sample person has none", () => {
  const { colophon } = renderSections({ ...sample, builtAt });
  assert.equal(
    colophon,
    'Built with AI agents at DevFest Milano, <time datetime="2026-10-10">October 10, 2026</time>. No trackers. Fonts served from this site.',
  );
  const linked = renderSections({ ...sample, builtAt: { event: "DevFest Venezia", url: "https://example.com/devfest" } }).colophon;
  assert.equal(linked, 'Built with AI agents at <a href="https://example.com/devfest">DevFest Venezia</a>. No trackers. Fonts served from this site.');
  assert.equal(renderSections(sample).colophon, "");
});

test("the page's new words come from labels, so a site in another language stays in it", () => {
  const labels = { basedIn: "Wohnt in", speaks: "Spricht", native: "Muttersprache", builtWith: "Mit KI-Agenten gebaut auf der", noTrackers: "Keine Tracker. Schriften von dieser Website." };
  const { bio, colophon } = renderSections({ ...sample, builtAt, language: "de", labels });
  assert.ok(bio.includes("Wohnt in</span> Milan, Italy (Mitteleuropäische Zeit)"), bio);
  assert.ok(bio.includes("Spricht</span> English (Muttersprache) und Italian (B2)"), bio);
  assert.ok(colophon.startsWith("Mit KI-Agenten gebaut auf der DevFest Milano, "), colophon);
  assert.ok(colophon.endsWith(". Keine Tracker. Schriften von dieser Website."), colophon);
  for (const english of ["Based in", "Speaks", "native", "Built with", "No trackers"]) {
    assert.ok(!(bio + colophon).includes(english), english);
  }
});

test("the new fields are escaped, never injected as markup", () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const { bio, colophon } = renderSections({
    ...sample,
    photo: { src: 'assets/a.webp" onerror="alert(1)', alt: hostile },
    pitch: hostile,
    highlights: [{ text: hostile, url: 'https://example.com/"onmouseover="alert(1)' }],
    availability: { text: hostile, actionLabel: hostile, actionUrl: 'mailto:a@example.com"onclick="alert(1)' },
    location: { city: hostile },
    languages: [{ name: hostile, level: "C1" }],
    builtAt: { event: hostile, url: 'https://example.com/"onclick="alert(1)' },
  });
  for (const html of [bio, colophon]) {
    assert.ok(!html.includes("<img src=x"), html);
    assert.ok(!/"on\w+="/.test(html), html);
  }
});

// What the site shows is the person's choice: a recruiter may call them.
test("a phone link is the person's choice: the schema takes tel: for the availability action and in the links", () => {
  const callable = {
    ...sample,
    availability: { text: "Available from November.", actionLabel: "Call me", actionUrl: "tel:+390000000000" },
    links: [...sample.links, { label: "Phone", url: "tel:+390000000000" }],
  };
  assert.deepEqual(validateContent(schema, callable), []);
});

test("in Chrome, the sample person's site from a workshop shows a round photo, the pitch, availability and the colophon line in the footer", async () => {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, "clean-sites/all-widgets");
  try {
    const shown = await inChrome(siteDir, `(() => {
      const photo = document.querySelector("#bio img.photo");
      return {
        photo: photo && { radius: getComputedStyle(photo).borderRadius, width: photo.getBoundingClientRect().width, height: photo.getBoundingClientRect().height },
        pitch: document.querySelector("#bio .pitch")?.textContent,
        availability: document.querySelector("#bio .availability a")?.getAttribute("href"),
        colophon: document.querySelector("footer #colophon:not([hidden])")?.textContent,
      };
    })()`);
    assert.equal(shown.photo?.radius, "50%");
    assert.ok(shown.photo.width > 0 && shown.photo.width === shown.photo.height, JSON.stringify(shown.photo));
    assert.equal(shown.pitch, atAWorkshop.pitch);
    assert.equal(shown.availability, atAWorkshop.availability.actionUrl);
    assert.match(shown.colophon, /^Built with AI agents at DevFest Milano/);
  } finally {
    await remove();
  }
});

// Every class name the page gets from the content file, documented for the
// Developer in the build skill or in widgets.md.
test("every class name the renderer writes is documented for the Developer", async () => {
  const docs = (await read("../.agents/skills/build/SKILL.md")) + (await read("../.agents/skills/build/widgets.md"));
  const html = Object.values(renderSections(sample)).join("");
  const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(([, names]) => names.split(" ")));
  assert.ok(classes.size > 10, [...classes].join(" "));
  for (const name of classes) assert.ok(docs.includes(`.${name}\``), name);
});
