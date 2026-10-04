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
};

export const pageLabels = (content) => ({ ...ENGLISH_LABELS, ...content.labels });

const renderEach = (items, renderItem) =>
  items?.length ? items.map(renderItem).join("") : "";

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

function renderBio(content) {
  return `
    <h1>${escapeHtml(content.name)}</h1>
    <p class="headline">${escapeHtml(content.headline)}</p>
    ${renderEach(content.bio, (paragraph) => `<p>${escapeHtml(paragraph)}</p>`)}`;
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

export function renderSections(content) {
  const labels = pageLabels(content);
  return {
    bio: renderBio(content),
    projects: renderProjects(content, labels),
    links: renderLinks(content, labels),
    cv: renderCv(content, labels),
    ...Object.fromEntries(
      Object.entries(OPTIONAL_MODULES).map(([module, detailField]) => [
        module,
        renderModule(content[module], labels[module], detailField),
      ]),
    ),
  };
}
