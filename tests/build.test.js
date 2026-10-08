import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, launchChrome, navigate, openTab } from "../tools/check/chrome.mjs";
import { BuildError, buildSite, todayFor } from "../tools/build/build-site.mjs";
import { elementsOf, escapeHtml, visibleText } from "../tools/build/html.mjs";
import { publicAddress } from "../tools/build/public-address.mjs";
import { serveBuild } from "../tools/build/serve-build.mjs";
import { sampleSite } from "./fixture-site.js";
import { withRepo } from "./participant-repo.js";
import { loadsFromElsewhere } from "./site-files.js";

const ADDRESS = "https://ada-example.github.io/portfolio/";
const sample = JSON.parse(await readFile(join(sampleSite, "content.json"), "utf8"));

// A copy of the sample site, changed by change(siteDir), built into a folder
// of its own; use() gets the built folder, what the build returned, and the
// site folder it was built from.
async function withBuilt({ change = async () => {}, ...options }, use) {
  const dir = await mkdtemp(join(tmpdir(), "build-"));
  const siteDir = join(dir, "site");
  const outDir = join(dir, "_site");
  try {
    await cp(sampleSite, siteDir, { recursive: true });
    await change(siteDir);
    const result = await buildSite(siteDir, outDir, { address: ADDRESS, today: "2026-10-07", ...options });
    return await use(outDir, result, siteDir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const read = (dir, file) => readFile(join(dir, file), "utf8");
const writeContent = (content) => (siteDir) => writeFile(join(siteDir, "content.json"), JSON.stringify(content, null, 2));
const writeFiles = (files) => async (siteDir) => {
  for (const [file, body] of Object.entries(files)) {
    await mkdir(join(siteDir, file, ".."), { recursive: true });
    await writeFile(join(siteDir, file), body);
  }
};
const both = (...changes) => async (siteDir) => {
  for (const change of changes) await change(siteDir);
};

// The structured data in a built page, parsed.
const jsonLdOf = (html) => elementsOf(html, (tag) => tag.name === "script" && tag.attributes.type === "application/ld+json").map(({ content }) => JSON.parse(content));

// The content of the tags in the page's head, such as { "og:title": "…" }.
function headTags(html) {
  const head = html.slice(0, html.indexOf("</head>"));
  const found = {};
  for (const [, key, value] of head.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)">/g)) found[key] = value;
  found.canonical = head.match(/<link rel="canonical" href="([^"]*)">/)?.[1];
  found.title = head.match(/<title>([^<]*)<\/title>/)?.[1];
  found.lang = html.match(/<html lang="([^"]*)"/)?.[1];
  return found;
}

test("the built home page holds every section of the sample content file in its HTML, before any JavaScript runs", async () => {
  await withBuilt({}, async (outDir) => {
    const html = await read(outDir, "index.html");
    const shown = visibleText(html);
    const cv = sample.cv;
    const values = [
      sample.name,
      sample.headline,
      ...sample.bio,
      ...sample.projects.flatMap((project) => [project.title, project.description]),
      ...sample.links.map((link) => link.label),
      ...cv.experience.flatMap((job) => [job.role, job.organization, job.summary]),
      ...cv.education.flatMap((school) => [school.title, school.organization]),
      ...cv.skills,
    ];
    for (const value of values) assert.ok(shown.includes(value), value);
    for (const url of [...sample.projects.map((project) => project.github), ...sample.links.map((link) => link.url)]) {
      assert.ok(html.includes(`href="${escapeHtml(url)}"`), url);
    }
    // The page's own words, from render.js, and the footer's link in the site's language.
    for (const heading of ["<h2>Projects</h2>", "<h2>Find me</h2>", "<h2>CV</h2>"]) assert.ok(html.includes(heading), heading);
  });
});

test("with JavaScript off, Chrome shows every section of the sample content file", async () => {
  const site = await serveBuild(sampleSite);
  let chrome;
  try {
    chrome = await launchChrome(findChrome());
    const { sessionId } = await openTab(chrome.cdp);
    await chrome.cdp.send("Emulation.setScriptExecutionDisabled", { value: true }, sessionId);
    await navigate(chrome.cdp, sessionId, `${site.origin}/`);
    const { result } = await chrome.cdp.send(
      "Runtime.evaluate",
      {
        expression: `({
          sections: [...document.querySelectorAll("main > .section:not([hidden])")].map((section) => section.id),
          name: document.querySelector("h1")?.textContent,
          headings: [...document.querySelectorAll("h2, h3")].map((heading) => heading.textContent.trim()),
        })`,
        returnByValue: true,
      },
      sessionId,
    );
    assert.deepEqual(result.value.sections, ["bio", "projects", "links", "cv"]);
    assert.equal(result.value.name, sample.name);
    assert.deepEqual(result.value.headings, ["Projects", ...sample.projects.map((project) => project.title), "Find me", "CV", "Experience", "Education", "Skills"]);
  } finally {
    await chrome?.close();
    await site.close();
  }
});

test("the built home page carries the real title, the description, the language, the canonical link and the link preview tags", async () => {
  // The sample person without a pitch and a photo: the headline describes the page.
  const { pitch, photo, ...withoutPitchOrPhoto } = sample;
  await withBuilt({ change: writeContent(withoutPitchOrPhoto) }, async (outDir) => {
    const tags = headTags(await read(outDir, "index.html"));
    assert.equal(tags.title, "Ada Example · Portfolio");
    assert.equal(tags.description, sample.headline);
    assert.equal(tags.lang, "en");
    assert.equal(tags.canonical, ADDRESS);
    assert.equal(tags["og:type"], "profile");
    assert.equal(tags["og:title"], "Ada Example · Portfolio");
    assert.equal(tags["og:description"], sample.headline);
    assert.equal(tags["og:url"], ADDRESS);
    assert.equal(tags["twitter:card"], "summary");
    // No photo: no image in the preview.
    assert.equal(tags["og:image"], undefined);
  });
});

test("a site in Italian with a pitch and a photo: the language, the pitch as description and the photo in link previews", async () => {
  const content = { ...sample, language: "it", pitch: "I build fast, accessible sites for small studios.", photo: { src: "assets/ada.webp", alt: "Ada Example, smiling" } };
  await withBuilt({ change: writeContent(content) }, async (outDir) => {
    const tags = headTags(await read(outDir, "index.html"));
    assert.equal(tags.lang, "it");
    assert.equal(tags.description, content.pitch);
    assert.equal(tags["og:description"], content.pitch);
    assert.equal(tags["og:image"], `${ADDRESS}assets/ada.webp`);
    assert.equal(tags["og:image:alt"], "Ada Example, smiling");
  });
});

test("the home page's structured data is a ProfilePage about the person, mapped from the sample content file", async () => {
  await withBuilt({}, async (outDir) => {
    const [page, ...more] = jsonLdOf(await read(outDir, "index.html"));
    assert.equal(more.length, 0, "one block of structured data");
    assert.equal(page["@context"], "https://schema.org");
    assert.equal(page["@type"], "ProfilePage");
    assert.equal(page.url, ADDRESS);
    assert.deepEqual(page.mainEntity, {
      "@type": "Person",
      name: "Ada Example",
      // The sample person's pitch, photo, languages and city.
      description: sample.pitch,
      image: `${ADDRESS}assets/avatar.svg`,
      knowsLanguage: [
        { "@type": "Language", name: "English" },
        { "@type": "Language", name: "Italian" },
      ],
      homeLocation: { "@type": "Place", name: "Milan" },
      jobTitle: "Junior Frontend Developer",
      url: ADDRESS,
      // https links only: the email address is not a profile.
      sameAs: ["https://github.com/octocat", "https://www.linkedin.com/in/ada-example"],
      knowsAbout: sample.cv.skills,
      alumniOf: [
        { "@type": "EducationalOrganization", name: "Example Academy" },
        { "@type": "EducationalOrganization", name: "Example University" },
      ],
      // The job that ends "present" is the current one; the one that ended in 2024 is not.
      worksFor: { "@type": "Organization", name: "Example Studio" },
    });
  });
});

// Ada Example with every optional field of the content file's contract in
// spec #17. All of it is made up; the city is the only place, as the
// contract allows.
const everything = {
  ...sample,
  photo: { src: "assets/ada.webp", alt: "Ada Example in front of a whiteboard" },
  pitch: "I turn slow marketing sites into fast, accessible ones.",
  highlights: [{ text: "Every page scores 100 for accessibility", url: "https://example.com/report" }],
  availability: { text: "Open to freelance work from November", actionLabel: "Email me", actionUrl: "mailto:ada@example.com" },
  location: { city: "Milano", country: "Italy", timeZone: "Europe/Rome" },
  languages: [
    { name: "Italian", level: "native" },
    { name: "English", level: "C1" },
  ],
  builtAt: { event: "DevFest Milano 2026", url: "https://example.com/devfest", date: "2026-10-10" },
  events: [
    { name: "Example Conf 2025", date: "2025-05-14", endDate: "2025-05-15", city: "Torino", url: "https://example.com/conf", role: "speaker", sessions: [{ type: "talk", title: "Fast pages for everyone", slides: "https://example.com/slides" }] },
    { name: "Example Meetup Online", date: "2026-02-03", online: true, url: "https://example.com/meetup", role: "speaker" },
    { name: "DevFest Milano 2026", date: "2026-10-10", city: "Milano", url: "https://example.com/devfest", role: "attendee", sessions: [{ type: "workshop", title: "AI-Native Web Development, Hands-On" }] },
  ],
  certifications: [
    { name: "Example Accessibility Specialist", issuer: "Example Academy", kind: "exam", issued: "2025-06", expires: "2028-06", credentialId: "EXAMPLE-0000", url: "https://example.com/verify/0000" },
    { name: "Example Course on Web Performance", issuer: "Example School", kind: "course", issued: "2024-11" },
  ],
  now: { updated: "2026-10", items: ["Learning the View Transitions API"] },
  stats: [{ value: "12", label: "sites shipped" }],
  cv: {
    ...sample.cv,
    experience: [{ role: "Freelance Web Developer", organization: "Ada Example Studio", start: "2025" }, { ...sample.cv.experience[0], end: "Presente" }, sample.cv.experience[1]],
    education: [...sample.cv.education, { title: "Accessibility Course", organization: "Example Academy", year: "2024" }],
  },
};

test("the structured data takes every optional field of the contract: photo, profiles, skills, schools, current jobs, languages, city, credentials and talks", async () => {
  await withBuilt({ change: writeContent(everything) }, async (outDir) => {
    const [{ mainEntity: person }] = jsonLdOf(await read(outDir, "index.html"));
    assert.equal(person.description, everything.pitch);
    assert.equal(person.image, `${ADDRESS}assets/ada.webp`);
    // Each school once, even when two entries name it.
    assert.deepEqual(person.alumniOf.map((school) => school.name), ["Example Academy", "Example University"]);
    // No end, or an end such as "Presente", is a current job.
    assert.deepEqual(person.worksFor, [
      { "@type": "Organization", name: "Ada Example Studio" },
      { "@type": "Organization", name: "Example Studio" },
    ]);
    assert.deepEqual(person.jobTitle, ["Freelance Web Developer", "Junior Frontend Developer"]);
    assert.deepEqual(person.knowsLanguage, [
      { "@type": "Language", name: "Italian" },
      { "@type": "Language", name: "English" },
    ]);
    // The city only.
    assert.deepEqual(person.homeLocation, { "@type": "Place", name: "Milano" });
    assert.deepEqual(person.hasCredential, [
      {
        "@type": "EducationalOccupationalCredential",
        name: "Example Accessibility Specialist",
        credentialCategory: "exam",
        recognizedBy: { "@type": "Organization", name: "Example Academy" },
        url: "https://example.com/verify/0000",
        dateCreated: "2025-06",
        expires: "2028-06",
      },
      {
        "@type": "EducationalOccupationalCredential",
        name: "Example Course on Web Performance",
        credentialCategory: "course",
        recognizedBy: { "@type": "Organization", name: "Example School" },
        dateCreated: "2024-11",
      },
    ]);
    // Only the events where the person spoke.
    assert.deepEqual(person.performerIn, [
      { "@type": "Event", name: "Example Conf 2025", startDate: "2025-05-14", endDate: "2025-05-15", location: { "@type": "Place", name: "Torino" }, url: "https://example.com/conf" },
      { "@type": "Event", name: "Example Meetup Online", startDate: "2026-02-03", location: { "@type": "VirtualLocation", url: "https://example.com/meetup" }, url: "https://example.com/meetup" },
    ]);
    assert.doesNotMatch(JSON.stringify(person), /Italy|EXAMPLE-0000|mailto/);
  });
});

test("no value can end the structured data's script: a name with </script> in it stays data", async () => {
  const name = 'Ada </script><script>alert("x")</script><!-- Example';
  await withBuilt({ change: writeContent({ ...sample, name }) }, async (outDir) => {
    const html = await read(outDir, "index.html");
    const [page] = jsonLdOf(html);
    assert.equal(page.mainEntity.name, name);
    assert.equal(html.match(/<script>alert/g), null);
    assert.equal(headTags(html).title, escapeHtml(`${name} · Portfolio`));
  });
});

test("robots.txt welcomes every crawler and names the sitemap; sitemap.xml lists the home and the privacy page; llms.txt sums up the person", async () => {
  await withBuilt({ change: writeContent(everything) }, async (outDir) => {
    const robots = await read(outDir, "robots.txt");
    assert.match(robots, /^User-agent: \*\nAllow: \/$/m);
    assert.doesNotMatch(robots, /Disallow/);
    assert.match(robots, new RegExp(`^Sitemap: ${ADDRESS}sitemap\\.xml$`, "m"));
    const sitemap = await read(outDir, "sitemap.xml");
    assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url), [ADDRESS, `${ADDRESS}privacy.html`]);
    const llms = await read(outDir, "llms.txt");
    const [title, , summary] = llms.split("\n");
    assert.equal(title, "# Ada Example");
    assert.equal(summary, `> ${everything.pitch}`);
    for (const line of [
      everything.headline,
      ...everything.bio,
      "- [Tide Tables](https://github.com/octocat/Hello-World): A tiny web app that shows today's tides for a chosen harbour, built with plain HTML, CSS and JavaScript.",
      "- [GitHub](https://github.com/octocat)",
      '- [Example Conf 2025](https://example.com/conf): 2025-05-14 – 2025-05-15, Torino. Speaker: talk "Fast pages for everyone".',
      '- [DevFest Milano 2026](https://example.com/devfest): 2026-10-10, Milano. Attendee: workshop "AI-Native Web Development, Hands-On".',
      "- [Example Accessibility Specialist](https://example.com/verify/0000): Example Academy, 2025-06",
      "- Availability: Open to freelance work from November",
      "- Based in: Milano",
      "- Languages: Italian (native), English (C1)",
    ]) {
      assert.ok(llms.split("\n").includes(line), line);
    }
    // Lists of links each under a heading of its own, after what the person tells about themselves.
    for (const heading of ["## Projects", "## Find me"]) assert.match(llms, new RegExp(`^${heading}$`, "m"));
    assert.ok(llms.indexOf("\n## ") > llms.indexOf(everything.bio.at(-1)));
    assert.doesNotMatch(llms, /Italy|EXAMPLE-0000/);
  });
});

test("without a known address, the build leaves out what needs one: the canonical link, the preview's address and image, and the sitemap", async () => {
  await withBuilt({ address: null, change: writeContent(everything) }, async (outDir, { files }) => {
    const html = await read(outDir, "index.html");
    const tags = headTags(html);
    assert.equal(tags.canonical, undefined);
    assert.equal(tags["og:url"], undefined);
    assert.equal(tags["og:image"], undefined);
    assert.equal(tags.title, "Ada Example · Portfolio");
    assert.equal(jsonLdOf(html)[0].mainEntity.name, "Ada Example");
    assert.equal(files.includes("sitemap.xml"), false);
    assert.doesNotMatch(await read(outDir, "robots.txt"), /Sitemap/);
    assert.ok(files.includes("llms.txt"));
  });
});

test("a section with no element in the page goes at the end of <main>; an element anywhere else, even in the footer, gets its section; an empty one is hidden", async () => {
  const withModule = { ...sample, projects: [], videos: [{ title: "My first talk", url: "https://www.youtube.com/watch?v=EXAMPLE0001" }] };
  const index = (await readFile(join(sampleSite, "index.html"), "utf8"))
    .replace('<section id="links" class="section"></section>', "")
    .replace('<a href="privacy.html">', '<div id="links" hidden></div>\n      <a href="privacy.html">');
  await withBuilt({ change: both(writeContent(withModule), writeFiles({ "index.html": index })) }, async (outDir) => {
    const html = await read(outDir, "index.html");
    const main = html.slice(html.indexOf("<main>"), html.indexOf("</main>"));
    const footer = html.slice(html.indexOf("<footer>"), html.indexOf("</footer>"));
    assert.match(main, /<section id="projects" class="section" hidden><\/section>/);
    assert.match(main, /<section id="videos" class="section"><h2>Videos<\/h2>[\s\S]*My first talk/);
    assert.ok(main.indexOf('id="videos"') > main.indexOf('id="cv"'), "the module comes last");
    // Modules without entries get no section at all.
    for (const module of ["podcasts", "posts", "resources", "ideas"]) assert.doesNotMatch(html, new RegExp(`id="${module}"`));
    assert.match(footer, /<div id="links"><h2>Find me<\/h2>/);
  });
});

test("the footer's link to the legal page is in the site's language", async () => {
  await withBuilt({ change: writeContent({ ...sample, language: "it", labels: { privacy: "Note legali e privacy" } }) }, async (outDir) => {
    assert.match(await read(outDir, "index.html"), /<footer>\s*<a href="privacy\.html">Note legali e privacy<\/a>/);
  });
});

test("the legal page keeps the title and language it was written with, gets its canonical link, and no sections of the home page", async () => {
  const finished = new URL("./fixtures/finished-privacy/privacy.html", import.meta.url);
  const page = (await readFile(finished, "utf8")).replace('<html lang="en">', '<html lang="en-GB">');
  await withBuilt({ change: both(writeContent({ ...sample, language: "it" }), writeFiles({ "privacy.html": page })) }, async (outDir) => {
    const html = await read(outDir, "privacy.html");
    const tags = headTags(html);
    assert.equal(tags.title, "Legal notice &amp; privacy · Ada Example");
    assert.equal(tags.lang, "en-GB");
    assert.equal(tags.canonical, `${ADDRESS}privacy.html`);
    assert.equal(tags["og:title"], "Legal notice &amp; privacy · Ada Example");
    assert.equal(tags["og:type"], "website");
    assert.equal(jsonLdOf(html).length, 0);
    assert.doesNotMatch(html, /id="projects"|Tide Tables/);
  });
});

test("a page's title without the person's name gets it: the placeholder legal page is \"Legal notice & privacy · Ada Example\"", async () => {
  await withBuilt({}, async (outDir) => {
    const tags = headTags(await read(outDir, "privacy.html"));
    assert.equal(tags.title, "Legal notice &amp; privacy · Ada Example");
    assert.equal(tags["og:title"], "Legal notice &amp; privacy · Ada Example");
  });
});

test("tags the Developer wrote into the head themselves are replaced, never doubled", async () => {
  const index = (await readFile(join(sampleSite, "index.html"), "utf8")).replace(
    "</head>",
    '  <link rel="canonical" href="https://example.com/old/">\n    <meta property="og:title" content="Old">\n    <meta name="twitter:card" content="summary_large_image">\n    <script type="application/ld+json">{"@type": "Person", "name": "Someone Else"}</script>\n  </head>',
  );
  await withBuilt({ change: writeFiles({ "index.html": index }) }, async (outDir) => {
    const html = await read(outDir, "index.html");
    for (const pattern of [/rel="canonical"/g, /og:title/g, /twitter:card/g, /application\/ld\+json/g, /<title>/g, /name="description"/g]) {
      assert.equal(html.match(pattern)?.length, 1, String(pattern));
    }
    assert.doesNotMatch(html, /Someone Else|example\.com\/old/);
  });
});

test("a page whose <head> has no end tag gets its tags in front of <body>", async () => {
  const index = (await readFile(join(sampleSite, "index.html"), "utf8")).replace(/[ \t]*<\/head>\r?\n/, "");
  assert.doesNotMatch(index, /<\/head>/);
  await withBuilt({ change: writeFiles({ "index.html": index }) }, async (outDir, { warnings }) => {
    const html = await read(outDir, "index.html");
    assert.deepEqual(warnings, []);
    assert.equal(headTags(html).title, "Ada Example · Portfolio");
    assert.ok(html.indexOf("application/ld+json") < html.indexOf("<body>"));
    assert.ok(html.indexOf('rel="canonical"') < html.indexOf("<body>"));
  });
});

test("render.js gets today's date, as YYYY-MM-DD, in the person's own time zone when the content file names one", async () => {
  const recorder = "export const renderSections = (content, options) => ({ bio: `<p>${options.today}</p>` });\n";
  await withBuilt({ today: undefined, change: writeFiles({ "assets/render.js": recorder }) }, async (outDir, { today }) => {
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(await read(outDir, "index.html"), new RegExp(`<p>${today}</p>`));
  });
  await withBuilt({ today: "2026-10-10", change: writeFiles({ "assets/render.js": recorder }) }, async (outDir) => {
    assert.match(await read(outDir, "index.html"), /<p>2026-10-10<\/p>/);
  });
  // 23:30 UTC on 9 October is already 10 October in Milano, still 9 October in New York.
  const lateEvening = new Date("2026-10-09T23:30:00Z");
  assert.equal(todayFor({ location: { city: "Milano", timeZone: "Europe/Rome" } }, lateEvening), "2026-10-10");
  assert.equal(todayFor({ location: { city: "New York", timeZone: "America/New_York" } }, lateEvening), "2026-10-09");
  assert.match(todayFor({ location: { timeZone: "Not/AZone" } }), /^\d{4}-\d{2}-\d{2}$/);
});

test("every other file of the site is copied as it is; what an earlier build left behind and the system's own files are not", async () => {
  await withBuilt({ change: writeFiles({ "assets/fonts/OFL.txt": "SIL Open Font License", ".DS_Store": "junk", "assets/Thumbs.db": "junk" }) }, async (outDir, result, siteDir) => {
    assert.equal(await read(outDir, "assets/fonts/OFL.txt"), "SIL Open Font License");
    assert.ok((await readFile(join(outDir, "assets", "styles.css"))).equals(await readFile(join(siteDir, "assets", "styles.css"))));
    assert.ok(!existsSync(join(outDir, ".DS_Store")) && !existsSync(join(outDir, "assets", "Thumbs.db")));
    // A second build after the font was deleted.
    await rm(join(siteDir, "assets", "fonts"), { recursive: true });
    await writeFile(join(outDir, "stray.html"), "an old page");
    await buildSite(siteDir, outDir, { address: ADDRESS });
    assert.ok(!existsSync(join(outDir, "assets", "fonts")), "the font's folder is gone");
    assert.ok(!existsSync(join(outDir, "stray.html")));
    assert.ok(existsSync(join(outDir, "index.html")));
  });
});

test("a file renamed only in upper and lower case keeps its new name in _site/, on every system", async () => {
  await withBuilt({}, async (outDir, result, siteDir) => {
    const icon = await readFile(join(siteDir, "assets", "favicon.svg"));
    await rm(join(siteDir, "assets", "favicon.svg"));
    await writeFile(join(siteDir, "assets", "Favicon.svg"), icon);
    await buildSite(siteDir, outDir, { address: ADDRESS });
    const names = await readdir(join(outDir, "assets"));
    assert.ok(names.includes("Favicon.svg"), names.join(", "));
    assert.ok(!names.includes("favicon.svg"), names.join(", "));
    assert.ok((await readFile(join(outDir, "assets", "Favicon.svg"))).equals(icon));
  });
});

test("a robots.txt, sitemap.xml or llms.txt of the person's own stays as they wrote it", async () => {
  await withBuilt({ change: writeFiles({ "robots.txt": "User-agent: *\nDisallow: /drafts/\n", "llms.txt": "# My own\n" }) }, async (outDir) => {
    assert.equal(await read(outDir, "robots.txt"), "User-agent: *\nDisallow: /drafts/\n");
    assert.equal(await read(outDir, "llms.txt"), "# My own\n");
    assert.ok(existsSync(join(outDir, "sitemap.xml")));
  });
});

test("a content file that starts with a byte order mark, as some Windows editors write it, is read like any other", async () => {
  const withMark = `\uFEFF${JSON.stringify(sample)}`;
  await withBuilt({ change: writeFiles({ "content.json": withMark }) }, async (outDir, { warnings }) => {
    assert.deepEqual(warnings, []);
    assert.match(await read(outDir, "index.html"), /<h1>Ada Example<\/h1>/);
  });
});

test("a content file that does not match the schema is named, and the page is built all the same", async () => {
  await withBuilt({ change: writeContent({ ...sample, nickname: "Ada" }) }, async (outDir, { warnings }) => {
    assert.deepEqual(warnings, ['content.json: "nickname" is not allowed in the content file.']);
    assert.match(await read(outDir, "index.html"), /<h1>Ada Example<\/h1>/);
  });
});

// The build's problem in plain words, and whether it wrote anything.
async function failedBuild(change) {
  const dir = await mkdtemp(join(tmpdir(), "build-fails-"));
  try {
    await cp(sampleSite, join(dir, "site"), { recursive: true });
    await change(join(dir, "site"));
    const error = await buildSite(join(dir, "site"), join(dir, "_site")).then(() => null, (error) => error);
    assert.ok(error instanceof BuildError, String(error));
    return { problem: error.message, wrote: existsSync(join(dir, "_site")) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

for (const [what, change, said] of [
  ["a content file that is not valid JSON", writeFiles({ "content.json": '{ "name": "Ada Example", }' }), /content\.json is not valid JSON: .*missing comma/],
  ["no content file", (siteDir) => rm(join(siteDir, "content.json")), /There is no content\.json.*Analyst/],
  ["a render.js with a mistake", writeFiles({ "assets/render.js": "export function renderSections( {" }), /assets\/render\.js has a mistake/],
  ["a render.js without renderSections", writeFiles({ "assets/render.js": "export const nothing = 1;" }), /no function renderSections/],
  ["a render.js that fails on the content", writeFiles({ "content.json": JSON.stringify({ ...sample, bio: "One string" }) }), /could not turn content\.json into the page.*bio must be a list/],
  ["no index.html", (siteDir) => rm(join(siteDir, "index.html")), /no index\.html/],
]) {
  test(`${what}: the build stops before it writes anything, and says why in plain words`, async () => {
    const { problem, wrote } = await failedBuild(change);
    assert.match(problem, said);
    assert.equal(wrote, false);
  });
}

test("a change to render.js shows in the next build, also in the same process", async () => {
  await withBuilt({}, async (outDir, result, siteDir) => {
    await writeFile(join(siteDir, "assets", "render.js"), "export const renderSections = () => ({ bio: '<h1>Changed</h1>' });\n");
    await buildSite(siteDir, outDir, { address: ADDRESS });
    assert.match(await read(outDir, "index.html"), /<h1>Changed<\/h1>/);
  });
});

test("on GitHub, version.txt names the commit the site was built from", async () => {
  await withBuilt({ commit: "0123456789abcdef0123456789abcdef01234567" }, async (outDir) => {
    assert.equal(await read(outDir, "version.txt"), "0123456789abcdef0123456789abcdef01234567\n");
  });
  await withBuilt({}, async (outDir) => assert.ok(!existsSync(join(outDir, "version.txt"))));
});

test("the built site loads nothing from other servers", async () => {
  await withBuilt({ change: writeContent(everything) }, async (outDir) => {
    assert.deepEqual(await loadsFromElsewhere(outDir), []);
  });
});

test("the site's address: a CNAME file first, then the repo GitHub Actions builds, then the repo's GitHub address; none without them", async () => {
  const dir = await mkdtemp(join(tmpdir(), "address-"));
  try {
    const git = (...args) => assert.equal(spawnSync("git", args, { cwd: dir }).status, 0, args.join(" "));
    assert.equal(publicAddress(dir, {}), null);
    assert.equal(publicAddress(dir, { GITHUB_REPOSITORY: "Ada-Example/portfolio" }), "https://ada-example.github.io/portfolio/");
    assert.equal(publicAddress(dir, { GITHUB_REPOSITORY: "Ada-Example/Ada-Example.github.io" }), "https://ada-example.github.io/");
    git("init", "-q");
    git("remote", "add", "origin", "git@github.com:Ada-Example/portfolio.git");
    assert.equal(publicAddress(dir, {}), "https://ada-example.github.io/portfolio/");
    await writeFile(join(dir, "CNAME"), "\nwww.ada-example.dev\n");
    assert.equal(publicAddress(dir, { GITHUB_REPOSITORY: "Ada-Example/portfolio" }), "https://www.ada-example.dev/");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// The one command, run the way a participant runs it, with no GitHub Actions
// around it: this test may run inside GitHub Actions itself.
const runBuild = (dir) => {
  const env = { ...process.env };
  for (const name of ["GITHUB_REPOSITORY", "GITHUB_SHA"]) delete env[name];
  return spawnSync(process.execPath, [join(dir, "tools", "build.mjs")], { cwd: dir, encoding: "utf8", env });
};

test("node tools/build.mjs writes the finished site into _site/ and says where it will be published", async () => {
  await withRepo(async (dir) => {
    const before = runBuild(dir);
    assert.equal(before.status, 0, before.stdout + before.stderr);
    assert.match(before.stdout, /Built your site into the folder _site\//);
    assert.match(before.stdout, /address is not known here.*not connected to a repo on GitHub/);
    spawnSync("git", ["init", "-q"], { cwd: dir });
    spawnSync("git", ["remote", "add", "origin", "https://github.com/Ada-Example/portfolio.git"], { cwd: dir });
    const { status, stdout } = runBuild(dir);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /Its address: https:\/\/ada-example\.github\.io\/portfolio\//);
    assert.match(stdout, /Pages: index\.html, privacy\.html/);
    assert.match(stdout, /robots\.txt, sitemap\.xml, llms\.txt/);
    assert.match(await read(join(dir, "_site"), "index.html"), /<h1>Ada Example<\/h1>/);
    assert.deepEqual((await readdir(join(dir, "_site"))).sort(), ["assets", "content.json", "content.schema.json", "index.html", "llms.txt", "privacy.html", "robots.txt", "sitemap.xml"]);
  });
});

test("node tools/build.mjs with a broken content file says what is wrong, fails, and leaves the last build as it was", async () => {
  await withRepo(async (dir) => {
    assert.equal(runBuild(dir).status, 0);
    const built = await read(join(dir, "_site"), "index.html");
    await writeFile(join(dir, "site", "content.json"), '{ "name": "Ada Example", ');
    const { status, stdout } = runBuild(dir);
    assert.equal(status, 1);
    assert.match(stdout, /Your site could not be built: content\.json is not valid JSON/);
    assert.match(stdout, /Nothing was written into _site\//);
    assert.equal(await read(join(dir, "_site"), "index.html"), built);
  });
});

// Git on Windows may check files out with CRLF line endings.
const readText = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");

test("AGENTS.md names the one build tool, the same command on every system, with no npm; and JavaScript only for extras", async () => {
  const rules = await readText("../AGENTS.md");
  const site = rules.split(/^## /m).find((part) => part.startsWith("The site"));
  const build = site.split("\n").find((line) => line.includes("`node tools/build.mjs`"));
  assert.ok(build, "AGENTS.md does not name node tools/build.mjs");
  for (const needed of [/One build tool/, /the same command on every system/, /never add npm packages, a `package\.json`/, /`_site\/`/]) assert.match(build, needed);
  assert.match(site, /JavaScript is only for extras, never for content/);
});

test("the Developer's skill says the build fills the page, JavaScript is for extras only, and what an agent sees is the Developer's", async () => {
  const skill = await readText("../.agents/skills/build/SKILL.md");
  for (const needed of ["`node tools/build.mjs` fills each one", "JavaScript only for extras, never for content", "what an agent sees; those are yours", "the preview builds the site again first"]) {
    assert.ok(skill.includes(needed), needed);
  }
});

test("no rule, skill or README says any more that there is no build step, or that main.js fills the page", async () => {
  const skills = (await readdir(new URL("../.agents/skills", import.meta.url))).filter((name) => name !== "modern-web-guidance");
  for (const file of ["../AGENTS.md", "../README.md", ...skills.map((name) => `../.agents/skills/${name}/SKILL.md`)]) {
    const text = await readText(file);
    assert.doesNotMatch(text, /no build step/i, file);
    assert.doesNotMatch(text, /main\.js`? (adds|fills|loads|renders)/, file);
  }
});
