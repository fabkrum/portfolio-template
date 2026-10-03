// Turns the content file into HTML for each section of the page.
// Pure functions, no DOM access, so the tests can run them in Node.

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderEach = (items, renderItem) =>
  items?.length ? items.map(renderItem).join("") : "";

// A heading plus a list, or nothing at all when there are no items.
const listWithHeading = (heading, className, items) =>
  items && `${heading}<ul class="${className}">${items}</ul>`;

function renderBio(content) {
  return `
    <h1>${escapeHtml(content.name)}</h1>
    <p class="headline">${escapeHtml(content.headline)}</p>
    ${renderEach(content.bio, (paragraph) => `<p>${escapeHtml(paragraph)}</p>`)}`;
}

function renderProjects(content) {
  const items = renderEach(
    content.projects,
    (project) => `
      <li class="project">
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.description)}</p>
        <p class="project-links">
          <a href="${escapeHtml(project.github)}">Code on GitHub</a>
          ${project.url ? `<a href="${escapeHtml(project.url)}">Live</a>` : ""}
        </p>
      </li>`,
  );
  return listWithHeading("<h2>Projects</h2>", "projects", items);
}

function renderLinks(content) {
  const items = renderEach(
    content.links,
    (link) =>
      `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`,
  );
  return listWithHeading("<h2>Find me</h2>", "links", items);
}

function renderCv(content) {
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
    listWithHeading("<h3>Experience</h3>", "cv-list", experience),
    listWithHeading("<h3>Education</h3>", "cv-list", education),
    listWithHeading("<h3>Skills</h3>", "skills", skills),
  ].join("");
  return parts && `<h2>CV</h2>${parts}`;
}

export function renderSections(content) {
  return {
    bio: renderBio(content),
    projects: renderProjects(content),
    links: renderLinks(content),
    cv: renderCv(content),
  };
}
