// Turns the content file into HTML for each section of the page.
// Pure functions, no DOM access, so the tests can run them in Node.

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// The page's own words, in English unless the content file's "labels" give
// them in the site's language.
const ENGLISH_LABELS = {
  projects: "Projects",
  links: "Find me",
  cv: "CV",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  code: "Code on GitHub",
  live: "Live",
  privacy: "Legal notice & privacy",
  vatId: "VAT number",
  videos: "Videos",
  podcasts: "Podcasts",
  posts: "Blog",
  resources: "Resources",
  ideas: "Project ideas",
  // The small facts under the pitch, and the colophon line in the footer.
  basedIn: "Based in",
  speaks: "Speaks",
  native: "native",
  builtWith: "Built with AI agents at",
  noTrackers: "No trackers. Fonts served from this site.",
  // The widgets: numbers, now, events with their roles and sessions,
  // certifications, and the case study of a project.
  stats: "In numbers",
  now: "Now",
  updated: "Updated",
  events: "Events",
  upcoming: "Up next",
  past: "Past events",
  online: "Online",
  slides: "Slides",
  video: "Video",
  attendee: "Attendee",
  speaker: "Speaker",
  organizer: "Organizer",
  volunteer: "Volunteer",
  mentor: "Mentor",
  talk: "Talk",
  workshop: "Workshop",
  keynote: "Keynote",
  panel: "Panel",
  codelab: "Codelab",
  certifications: "Certifications",
  courses: "Courses & workshops",
  verify: "Verify",
  credentialId: "Credential ID",
  problem: "Problem",
  role: "My role",
  outcome: "Outcome",
  stack: "Stack",
  aiNote: "With AI",
};

export const pageLabels = (content) => ({ ...ENGLISH_LABELS, ...content.labels });

const renderEach = (items, renderItem) =>
  items?.length ? items.map(renderItem).join("") : "";

// Text with something in it, or undefined: optional fields may be left empty.
const filled = (value) => (typeof value === "string" && value.trim() ? value : undefined);

// The entries of a list in the content file; none when it is not a list, so
// a slip in the file leaves a part out and the Check names it.
const entriesOf = (value) => (Array.isArray(value) ? value : []);

// A link around already escaped HTML, or that HTML alone when there is no address.
const linked = (url, html) => (filled(url) ? `<a href="${escapeHtml(url)}">${html}</a>` : html);

// The site's language for dates, lists and time zones; English when the
// browser or Node does not know it.
function localeOf(content) {
  try {
    return new Intl.Locale(content.language ?? "en").toString();
  } catch {
    return "en";
  }
}

// A date of the content file, 2026-10-10 or 2026-10 (a whole month), as
// { time, day }; undefined for anything else.
function parseDate(value) {
  const [, year, month, day] = String(value).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/) ?? [];
  return year ? { time: Date.UTC(Number(year), Number(month) - 1, Number(day ?? 1)), day } : undefined;
}

// How a date is written: "long" in a sentence, October 10, 2026; "short"
// in a list, Oct 10, 2026. A month alone: October 2026, Oct 2026.
const dateOptions = ({ day }, length) =>
  day ? { dateStyle: length === "long" ? "long" : "medium" } : { year: "numeric", month: length };

const dateFormat = (date, locale, length) => new Intl.DateTimeFormat(locale, { ...dateOptions(date, length), timeZone: "UTC" });

// A date written out in the site's language, in a <time> element.
function timeElement(value, locale, length = "long") {
  const date = parseDate(value);
  const text = date ? dateFormat(date, locale, length).format(date.time) : value;
  return `<time datetime="${escapeHtml(value)}">${escapeHtml(text)}</time>`;
}

// The first and last day of something that lasts longer than a day, such
// as Nov 20 – 21, 2026; or its one date.
function dateRange(start, end, locale) {
  const from = parseDate(start);
  const to = filled(end) && parseDate(end);
  if (!from || !to || Boolean(from.day) !== Boolean(to.day) || to.time <= from.time) return timeElement(start, locale, "short");
  return `<time datetime="${escapeHtml(start)}">${escapeHtml(dateFormat(from, locale, "short").formatRange(from.time, to.time))}</time>`;
}

// The last day a date stands for: a month alone lasts to its end. Dates
// written as year-month-day compare as text.
const lastDayOf = (value) => (/^\d{4}-\d{2}$/.test(value) ? `${value}-31` : value);

// Today as year-month-day, where the page is built or shown.
function currentDay() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
}

// The name of a time zone such as Europe/Rome in the site's language,
// "Central European Time"; undefined for a name the browser does not know.
function timeZoneName(timeZone, locale) {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "longGeneric" }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value;
  } catch {
    return undefined;
  }
}

// "English (native) and Italian (B2)", in the site's language.
function listOf(items, locale) {
  try {
    return new Intl.ListFormat(locale, { type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

// A heading plus a list, or nothing at all when there are no items.
const listWithHeading = (heading, className, items) =>
  items && `${heading}<ul class="${className}">${items}</ul>`;

// One card: a project, or an entry of an Optional module. Both use this, so
// they always look the same. "heading" and "body" are HTML, already escaped.
const card = (heading, body) => `
      <li class="project">
        <h3>${heading}</h3>
        ${body}
      </li>`;

// The photo, the first thing on the page: its size is set so nothing jumps
// while it loads, and it loads early, never lazily. The photo tool makes it
// 480 pixels square, sharp at 160 on any screen. Without alt text it is left
// out; the Check names the missing alt text under the content file.
function renderPhoto(photo) {
  if (!filled(photo?.src) || !filled(photo?.alt)) return "";
  return `
    <img class="photo" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt)}" width="160" height="160" fetchpriority="high" decoding="async">`;
}

// What a visitor gets from the person, each with its proof link if it has one.
function renderHighlights(highlights) {
  const items = renderEach(
    entriesOf(highlights).filter((highlight) => filled(highlight?.text)),
    (highlight) => `<li>${linked(highlight.url, escapeHtml(highlight.text))}</li>`,
  );
  return items && `
    <ul class="highlights">${items}</ul>`;
}

// Whether the person is available, and the link a visitor clicks to act on it.
function renderAvailability(availability) {
  if (!filled(availability?.text)) return "";
  const action =
    filled(availability.actionUrl) && filled(availability.actionLabel)
      ? ` <a href="${escapeHtml(availability.actionUrl)}">${escapeHtml(availability.actionLabel)}</a>`
      : "";
  return `
    <p class="availability">${escapeHtml(availability.text)}${action}</p>`;
}

// City, time zone and languages, as small facts under the pitch.
function renderFacts(content, labels, locale) {
  const fact = (className, label, text) => `<li class="${className}"><span class="fact-label">${escapeHtml(label)}</span> ${escapeHtml(text)}</li>`;
  const facts = [];
  const { city, country, timeZone } = content.location ?? {};
  if (filled(city)) {
    const place = [city, country].filter(filled).join(", ");
    const zone = filled(timeZone) && timeZoneName(timeZone, locale);
    facts.push(fact("location", labels.basedIn, zone ? `${place} (${zone})` : place));
  }
  const spoken = entriesOf(content.languages)
    .filter((language) => filled(language?.name))
    .map(({ name, level }) => (filled(level) ? `${name} (${level === "native" ? labels.native : level})` : name));
  if (spoken.length > 0) facts.push(fact("languages", labels.speaks, listOf(spoken, locale)));
  return facts.length > 0 ? `
    <ul class="facts">${facts.join("")}</ul>` : "";
}

// The first screen: photo, name and headline, then the pitch, the
// highlights, availability and the facts, then the bio.
function renderBio(content, labels, locale) {
  const pitch = filled(content.pitch) ? `
    <p class="pitch">${escapeHtml(content.pitch)}</p>` : "";
  const firstScreen = [
    pitch,
    renderHighlights(content.highlights),
    renderAvailability(content.availability),
    renderFacts(content, labels, locale),
  ].join("");
  return `${renderPhoto(content.photo)}
    <h1>${escapeHtml(content.name)}</h1>
    <p class="headline">${escapeHtml(content.headline)}</p>${firstScreen}
    ${renderEach(content.bio, (paragraph) => `<p>${escapeHtml(paragraph)}</p>`)}`;
}

// The line in the footer: the VAT number, which Italy wants on the home page,
// then built with AI agents at the event, no trackers, fonts served from this
// site.
function renderColophon(content, labels, locale) {
  const vat = filled(content.legal?.vatId) ? `<span class="vat">${escapeHtml(labels.vatId)} ${escapeHtml(content.legal.vatId)}</span>` : "";
  const { event, url, date } = content.builtAt ?? {};
  if (!filled(event)) return vat;
  const when = filled(date) ? `, ${timeElement(date, locale)}` : "";
  const built = `${escapeHtml(labels.builtWith)} ${linked(url, escapeHtml(event))}${when}. ${escapeHtml(labels.noTrackers)}`;
  return vat ? `${vat} · ${built}` : built;
}

// Up to four honest numbers, each with what it counts.
function renderStats(content, labels) {
  const items = renderEach(
    entriesOf(content.stats).filter((stat) => filled(String(stat?.value ?? "")) && filled(stat?.label)).slice(0, 4),
    ({ value, label }) => `<li class="stat"><span class="stat-value">${escapeHtml(value)}</span> <span class="stat-label">${escapeHtml(label)}</span></li>`,
  );
  return listWithHeading(`<h2>${escapeHtml(labels.stats)}</h2>`, "stats", items);
}

// What the person is doing now, up to three things, and when they wrote it.
function renderNow(content, labels, locale) {
  const items = renderEach(entriesOf(content.now?.items).filter(filled).slice(0, 3), (item) => `<li>${escapeHtml(item)}</li>`);
  if (!items) return "";
  const updated = filled(content.now.updated) ? `<p class="period">${escapeHtml(labels.updated)} ${timeElement(content.now.updated, locale)}</p>` : "";
  return `<h2>${escapeHtml(labels.now)}</h2>${updated}<ul class="now">${items}</ul>`;
}

// A word for one of a few known values, such as a role or a session type,
// from labels; any other value as it is.
const ROLES = ["attendee", "speaker", "organizer", "volunteer", "mentor"];
const SESSION_TYPES = ["talk", "workshop", "keynote", "panel", "codelab"];
const wordFor = (value, known, labels) => escapeHtml(known.includes(value) ? labels[value] : value);

// A session badge: its type and title. Its slides and video follow it.
function renderSession(session, labels) {
  const extras = [["slides", session.slides], ["video", session.video]]
    .filter(([, url]) => filled(url))
    .map(([label, url]) => ` <a href="${escapeHtml(url)}">${escapeHtml(labels[label])}</a>`)
    .join("");
  const badge = `<span class="session-badge"><span class="type">${wordFor(session.type, SESSION_TYPES, labels)}</span> ${linked(session.url, escapeHtml(session.title))}</span>`;
  return `<li class="session">${badge}${extras}</li>`;
}

// An event: the container of its sessions, with its badge, name and role,
// then its dates and city.
function renderEvent(event, labels, locale) {
  const role = filled(event.role) ? ` <span class="role">${wordFor(event.role, ROLES, labels)}</span>` : "";
  const place = [filled(event.city), event.online === true && labels.online].filter(Boolean).map(escapeHtml).join(" · ");
  const sessions = renderEach(entriesOf(event.sessions).filter((session) => filled(session?.title)), (session) => renderSession(session, labels));
  return `
      <li class="event">
        <h4 class="event-badge">${linked(event.url, escapeHtml(event.name))}${role}</h4>
        <p class="period">${dateRange(event.date, event.endDate, locale)}${place ? ` · ${place}` : ""}</p>${sessions ? `
        <ul class="sessions">${sessions}</ul>` : ""}
      </li>`;
}

// Events still to come first, as Up next, the soonest first; then past
// ones, the latest first. An event is still to come up to its last day.
function renderEvents(content, labels, locale, today) {
  const events = entriesOf(content.events).filter((event) => filled(event?.name) && filled(event?.date));
  const ahead = (event) => lastDayOf(filled(event.endDate) ?? event.date) >= today;
  const upcoming = events.filter(ahead).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((event) => !ahead(event)).sort((a, b) => b.date.localeCompare(a.date));
  const group = (heading, className, entries) =>
    listWithHeading(`<h3>${escapeHtml(heading)}</h3>`, `events ${className}`, renderEach(entries, (event) => renderEvent(event, labels, locale)));
  const groups = group(labels.upcoming, "upcoming", upcoming) + group(labels.past, "past", past);
  return groups && `<h2>${escapeHtml(labels.events)}</h2>${groups}`;
}

// Certifications, or courses and workshops: each with its issuer, its dates,
// its credential ID and the link that verifies it.
function renderCredentials(entries, heading, labels, locale) {
  const items = renderEach(entries, (entry) => {
    const dates = filled(entry.expires)
      ? `${timeElement(entry.issued, locale, "short")} – ${timeElement(entry.expires, locale, "short")}`
      : timeElement(entry.issued, locale, "short");
    const id = filled(entry.credentialId) ? `
        <p class="credential-id">${escapeHtml(labels.credentialId)} ${escapeHtml(entry.credentialId)}</p>` : "";
    const verify = filled(entry.url) ? `
        <p class="verify"><a href="${escapeHtml(entry.url)}">${escapeHtml(labels.verify)}</a></p>` : "";
    return `
      <li class="certification">
        <h3>${escapeHtml(entry.name)}</h3>
        <p class="period">${escapeHtml(entry.issuer)} · ${dates}</p>${id}${verify}
      </li>`;
  });
  return listWithHeading(`<h2>${escapeHtml(heading)}</h2>`, "certifications", items);
}

// Certifications from an exam under their own heading, courses and
// workshops under another; expired ones are left out. The latest first.
function renderCertifications(content, labels, locale, today) {
  const valid = entriesOf(content.certifications)
    .filter((entry) => filled(entry?.name) && filled(entry?.issuer) && filled(entry?.issued))
    .filter((entry) => !filled(entry.expires) || lastDayOf(entry.expires) >= today)
    .sort((a, b) => b.issued.localeCompare(a.issued));
  return {
    certifications: renderCredentials(valid.filter((entry) => entry.kind === "exam"), labels.certifications, labels, locale),
    courses: renderCredentials(valid.filter((entry) => entry.kind !== "exam"), labels.courses, labels, locale),
  };
}

// What a project's case study says, in this order, each under its label.
const CASE_STUDY = ["problem", "role", "outcome", "stack", "aiNote"];

// A project; with a picture and a case study when it has them, and as
// before when it has neither.
function renderProjects(content, labels) {
  const items = renderEach(content.projects, (project) => {
    const { image } = project;
    const picture = filled(image?.src) && filled(image?.alt) ? `<img class="project-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">
        ` : "";
    const caseStudy = CASE_STUDY.filter((field) => filled(project[field]))
      .map((field) => `<dt>${escapeHtml(labels[field])}</dt><dd>${escapeHtml(project[field])}</dd>`)
      .join("");
    return card(
      escapeHtml(project.title),
      `${picture}<p>${escapeHtml(project.description)}</p>${caseStudy ? `
        <dl class="case-study">${caseStudy}</dl>` : ""}
        <p class="project-links">
          <a href="${escapeHtml(project.github)}">${escapeHtml(labels.code)}</a>
          ${project.url ? `<a href="${escapeHtml(project.url)}">${escapeHtml(labels.live)}</a>` : ""}
        </p>`,
    );
  });
  return listWithHeading(`<h2>${escapeHtml(labels.projects)}</h2>`, "projects", items);
}

function renderLinks(content, labels) {
  const items = renderEach(
    content.links,
    (link) =>
      `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`,
  );
  return listWithHeading(`<h2>${escapeHtml(labels.links)}</h2>`, "links", items);
}

function renderCv(content, labels) {
  const cv = content.cv;
  if (!cv) return "";
  const experience = renderEach(
    cv.experience,
    (job) => `
      <li>
        <h4>${escapeHtml(job.role)} · ${escapeHtml(job.organization)}</h4>
        <p class="period">${escapeHtml(job.start)}${job.end ? ` – ${escapeHtml(job.end)}` : ""}</p>
        ${job.summary ? `<p>${escapeHtml(job.summary)}</p>` : ""}
      </li>`,
  );
  const education = renderEach(
    cv.education,
    (school) => `
      <li>
        <h4>${escapeHtml(school.title)} · ${escapeHtml(school.organization)}</h4>
        ${school.year ? `<p class="period">${escapeHtml(school.year)}</p>` : ""}
      </li>`,
  );
  const skills = renderEach(cv.skills, (skill) => `<li>${escapeHtml(skill)}</li>`);
  const parts = [
    listWithHeading(`<h3>${escapeHtml(labels.experience)}</h3>`, "cv-list", experience),
    listWithHeading(`<h3>${escapeHtml(labels.education)}</h3>`, "cv-list", education),
    listWithHeading(`<h3>${escapeHtml(labels.skills)}</h3>`, "skills", skills),
  ].join("");
  return parts && `<h2>${escapeHtml(labels.cv)}</h2>${parts}`;
}

// The Optional modules, each with the field shown under an entry's title, if
// any. Each entry is a card like a project, so a module's section takes on
// the look the Developer gave the projects. The title links to the entry.
const OPTIONAL_MODULES = {
  videos: null,
  podcasts: "show",
  posts: "date",
  resources: null,
  ideas: null,
};

function renderModule(entries, heading, detailField) {
  const items = renderEach(entries, (entry) => {
    const title = entry.url
      ? `<a href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a>`
      : escapeHtml(entry.title);
    const detail = detailField && entry[detailField];
    return card(
      title,
      `${detail ? `<p class="period">${escapeHtml(detail)}</p>` : ""}
        ${entry.description ? `<p>${escapeHtml(entry.description)}</p>` : ""}`,
    );
  });
  return listWithHeading(`<h2>${escapeHtml(heading)}</h2>`, "projects", items);
}

// The HTML of each part of the page, by the id of the element it fills. A
// part with no element of that id in index.html goes at the end of <main>.
// The colophon's element is in the footer: <div id="colophon"></div>.
// "today", as year-month-day, splits upcoming from past events and leaves
// out expired certifications; without it, it is the current date.
export function renderSections(content, { today } = {}) {
  const labels = pageLabels(content);
  const locale = localeOf(content);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(today ?? "") ? today : currentDay();
  return {
    bio: renderBio(content, labels, locale),
    stats: renderStats(content, labels),
    now: renderNow(content, labels, locale),
    projects: renderProjects(content, labels),
    events: renderEvents(content, labels, locale, day),
    ...renderCertifications(content, labels, locale, day),
    links: renderLinks(content, labels),
    cv: renderCv(content, labels),
    ...Object.fromEntries(
      Object.entries(OPTIONAL_MODULES).map(([module, detailField]) => [
        module,
        renderModule(content[module], labels[module], detailField),
      ]),
    ),
    colophon: renderColophon(content, labels, locale),
  };
}
