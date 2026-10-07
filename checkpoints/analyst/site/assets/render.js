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
  privacy: "Privacy",
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
};

export const pageLabels = (content) => ({ ...ENGLISH_LABELS, ...content.labels });

const renderEach = (items, renderItem) =>
  items?.length ? items.map(renderItem).join("") : "";

// Text with something in it, or undefined: optional fields may be left empty.
const filled = (value) => (typeof value === "string" && value.trim() ? value : undefined);

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

// A date of the content file, such as 2026-10-10 or 2026-10, written out in
// the site's language: "October 10, 2026" or "October 2026".
function formatDate(value, locale) {
  const [, year, month, day] = String(value).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/) ?? [];
  if (!year) return escapeHtml(value);
  const date = Date.UTC(Number(year), Number(month) - 1, Number(day ?? 1));
  const options = day ? { dateStyle: "long" } : { year: "numeric", month: "long" };
  return escapeHtml(new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date));
}

const timeElement = (value, locale) => `<time datetime="${escapeHtml(value)}">${formatDate(value, locale)}</time>`;

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
    highlights?.filter((highlight) => filled(highlight?.text)),
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
  const spoken = (content.languages ?? [])
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

// The line in the footer: built with AI agents at the event, no trackers,
// fonts served from this site.
function renderColophon(content, labels, locale) {
  const { event, url, date } = content.builtAt ?? {};
  if (!filled(event)) return "";
  const when = filled(date) ? `, ${timeElement(date, locale)}` : "";
  return `${escapeHtml(labels.builtWith)} ${linked(url, escapeHtml(event))}${when}. ${escapeHtml(labels.noTrackers)}`;
}

function renderProjects(content, labels) {
  const items = renderEach(content.projects, (project) =>
    card(
      escapeHtml(project.title),
      `<p>${escapeHtml(project.description)}</p>
        <p class="project-links">
          <a href="${escapeHtml(project.github)}">${escapeHtml(labels.code)}</a>
          ${project.url ? `<a href="${escapeHtml(project.url)}">${escapeHtml(labels.live)}</a>` : ""}
        </p>`,
    ),
  );
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
export function renderSections(content) {
  const labels = pageLabels(content);
  const locale = localeOf(content);
  return {
    bio: renderBio(content, labels, locale),
    projects: renderProjects(content, labels),
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
