// Who the person is, for search engines and AI agents, from the content
// file: the structured data (JSON-LD) in the home page, and llms.txt, a short
// summary in Markdown that follows llmstxt.org. Every field but the name may
// be missing; a field that is missing is left out.

// A value from the content file, if it is text with something in it.
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const list = (value) => (Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object") : []);
const texts = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
const unique = (values) => [...new Set(values)];
const https = (url) => (text(url)?.startsWith("https://") ? text(url) : undefined);

// One value as it is, several as a list, none as nothing.
const oneOrMore = (values) => (values.length > 1 ? values : values[0]);

// The object without the fields that are missing or empty lists.
const compact = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)));

// A job is the current one when it has no end, or an end such as "present".
const ONGOING = /^(present|now|today|current(ly)?|ongoing|presente|oggi|attuale|ad oggi|in corso|heute|jetzt|aktuell|bis heute|actualidad|actualmente|hoy|aujourd'hui|maintenant|en cours|atual|hoje)$/iu;
export const isCurrentJob = (job) => !text(job.end) || ONGOING.test(text(job.end));

const currentJobs = (content) => list(content.cv?.experience).filter((job) => text(job.organization) && isCurrentJob(job));

// The photo's address on the published site, if there is a photo and the
// site's address is known.
export function photoUrl(content, address) {
  const src = text(content.photo?.src);
  if (!src || !address) return undefined;
  try {
    return new URL(src, address).href;
  } catch {
    return undefined;
  }
}

const organization = (name) => ({ "@type": "Organization", name });

// The structured data of the home page: a ProfilePage whose main entity is
// the person (schema.org). Null without a name: there is no one to describe.
export function profilePage(content, { address, title }) {
  const name = text(content.name);
  if (!name) return null;
  const cv = content.cv && typeof content.cv === "object" ? content.cv : {};
  const jobs = currentJobs(content);
  const city = text(content.location?.city);
  const person = compact({
    "@type": "Person",
    name,
    description: text(content.pitch) ?? text(content.headline),
    jobTitle: oneOrMore(unique(jobs.map((job) => text(job.role)).filter(Boolean))),
    url: address ?? undefined,
    image: photoUrl(content, address),
    sameAs: unique(list(content.links).map((link) => https(link.url)).filter(Boolean)),
    knowsAbout: unique(texts(cv.skills)),
    alumniOf: unique(list(cv.education).map((school) => text(school.organization)).filter(Boolean)).map((school) => ({
      "@type": "EducationalOrganization",
      name: school,
    })),
    worksFor: oneOrMore(unique(jobs.map((job) => text(job.organization))).map(organization)),
    knowsLanguage: unique(list(content.languages).map((language) => text(language.name)).filter(Boolean)).map((language) => ({
      "@type": "Language",
      name: language,
    })),
    // The city only: never a street or a postcode.
    homeLocation: city ? { "@type": "Place", name: city } : undefined,
    hasCredential: list(content.certifications)
      .filter((credential) => text(credential.name))
      .map((credential) =>
        compact({
          "@type": "EducationalOccupationalCredential",
          name: text(credential.name),
          credentialCategory: text(credential.kind),
          recognizedBy: text(credential.issuer) ? organization(text(credential.issuer)) : undefined,
          url: text(credential.url),
          dateCreated: text(credential.issued),
          expires: text(credential.expires),
        }),
      ),
    performerIn: list(content.events)
      .filter((event) => text(event.role)?.toLowerCase() === "speaker" && text(event.name))
      .map((event) =>
        compact({
          "@type": "Event",
          name: text(event.name),
          startDate: text(event.date),
          endDate: text(event.endDate),
          location: text(event.city)
            ? { "@type": "Place", name: text(event.city) }
            : event.online === true && https(event.url)
              ? { "@type": "VirtualLocation", url: https(event.url) }
              : undefined,
          url: text(event.url),
        }),
      ),
  });
  return compact({ "@context": "https://schema.org", "@type": "ProfilePage", name: title, url: address ?? undefined, mainEntity: person });
}

// The structured data as the content of a <script> element: "<" written as
// \u003c, so that no value can end the script or open a comment.
export const jsonLdScript = (data) =>
  `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replaceAll("<", "\\u003c")}\n</script>`;

// Markdown: one line of text, a link text, and an address in a link.
const plain = (value) => String(value).replace(/\s+/g, " ").trim();
const linkText = (value) => plain(value).replace(/([\\[\]])/g, "\\$1");
const linkTarget = (url) => plain(url).replace(/[ ()<>]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

// One entry of a list of links, "- [name](url): notes", or without a link
// when there is no address to go to.
function entry(name, url, notes = []) {
  const said = notes.map(text).filter(Boolean).map(plain).join(" ");
  const head = url ? `[${linkText(name)}](${linkTarget(url)})` : linkText(name);
  return `- ${head}${said ? `: ${said}` : ""}`;
}

const period = (start, end) => [text(start), text(end)].filter(Boolean).join(" – ");

// The Optional modules: their key, their heading in English, and the fields
// told after an entry's title.
const MODULES = {
  videos: ["Videos", []],
  podcasts: ["Podcasts", ["show"]],
  posts: ["Blog", ["date"]],
  resources: ["Resources", []],
  ideas: ["Project ideas", []],
};

// llms.txt (llmstxt.org): the name as its title, a one-line summary, what the
// person tells about themselves, and lists of links: projects, profiles,
// events and the rest. Headings use the page's own words, the labels.
export function llmsTxt(content, labels, { address, title, privacy }) {
  const label = (key, english) => text(labels[key]) ?? english;
  const lines = [`# ${plain(text(content.name) ?? title)}`, ""];
  const summary = text(content.pitch) ?? text(content.headline);
  if (summary) lines.push(`> ${plain(summary)}`, "");
  if (text(content.pitch) && text(content.headline)) lines.push(plain(content.headline), "");
  for (const paragraph of texts(content.bio)) lines.push(plain(paragraph), "");

  // Facts, each after a word in English: they are for agents.
  const languages = list(content.languages)
    .filter((language) => text(language.name))
    .map((language) => (text(language.level) ? `${text(language.name)} (${text(language.level)})` : text(language.name)));
  const facts = [
    text(content.availability?.text) && `- Availability: ${plain(content.availability.text)}`,
    text(content.location?.city) && `- Based in: ${plain(content.location.city)}`,
    languages.length > 0 && `- Languages: ${plain(languages.join(", "))}`,
    texts(content.cv?.skills).length > 0 && `- Skills: ${plain(texts(content.cv.skills).join(", "))}`,
  ].filter(Boolean);
  if (facts.length > 0) lines.push(...facts, "");

  const experience = list(content.cv?.experience).filter((job) => text(job.role));
  if (experience.length > 0) {
    lines.push(`${label("experience", "Experience")}:`);
    for (const job of experience) {
      const said = [text(job.role), text(job.organization), period(job.start, job.end)].filter(Boolean).join(", ");
      lines.push(`- ${plain(said)}${text(job.summary) ? `: ${plain(job.summary)}` : ""}`);
    }
    lines.push("");
  }
  const education = list(content.cv?.education).filter((school) => text(school.title));
  if (education.length > 0) {
    lines.push(`${label("education", "Education")}:`);
    for (const school of education) lines.push(`- ${plain([text(school.title), text(school.organization), text(school.year)].filter(Boolean).join(", "))}`);
    lines.push("");
  }

  const section = (heading, entries) => {
    if (entries.length > 0) lines.push(`## ${plain(heading)}`, "", ...entries, "");
  };
  section(
    label("projects", "Projects"),
    list(content.projects)
      .filter((project) => text(project.title))
      .map((project) =>
        entry(project.title, text(project.url) ?? text(project.github), [
          project.description,
          project.outcome,
          text(project.url) && text(project.github) && `${label("code", "Code")}: ${project.github}`,
        ]),
      ),
  );
  section(
    label("links", "Links"),
    list(content.links)
      .filter((link) => text(link.label) && text(link.url))
      .map((link) => entry(link.label, link.url)),
  );
  section(
    label("events", "Events"),
    list(content.events)
      .filter((event) => text(event.name))
      .map((event) => {
        const sessions = list(event.sessions).filter((session) => text(session.title));
        const where = text(event.city) ?? (event.online === true ? "online" : undefined);
        const url = text(event.url) ?? sessions.map((session) => text(session.url)).find(Boolean);
        const role = text(event.role) && `${text(event.role)[0].toUpperCase()}${text(event.role).slice(1)}`;
        const said = sessions.map((session) => [text(session.type), `"${plain(session.title)}"`].filter(Boolean).join(" ")).join("; ");
        return entry(event.name, url, [
          `${[period(event.date, event.endDate), where].filter(Boolean).join(", ")}.`,
          role && `${role}${said ? `: ${said}` : ""}.`,
        ]);
      }),
  );
  section(
    label("certifications", "Certifications"),
    list(content.certifications)
      .filter((credential) => text(credential.name))
      .map((credential) => entry(credential.name, text(credential.url), [[text(credential.issuer), text(credential.issued)].filter(Boolean).join(", ")])),
  );
  for (const [module, [english, details]] of Object.entries(MODULES)) {
    section(
      label(module, english),
      list(content[module])
        .filter((item) => text(item.title))
        .map((item) => entry(item.title, text(item.url), [...details.map((field) => item[field]), item.description])),
    );
  }
  if (address) {
    section("Optional", [
      entry(title, address, ["all of the above as a web page"]),
      ...(privacy ? [entry(label("privacy", "Privacy"), new URL("privacy.html", address).href)] : []),
    ]);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
