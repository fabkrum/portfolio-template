// Loads the content file and fills every section of the page from it.
import { pageLabels, renderSections } from "./render.js";

async function loadContent() {
  const response = await fetch("content.json");
  if (!response.ok) throw new Error(`content.json: HTTP ${response.status}`);
  return response.json();
}

try {
  const content = await loadContent();
  document.documentElement.lang = content.language ?? "en";
  document.title = `${content.name} · Portfolio`;
  const privacyLink = document.querySelector('footer a[href="privacy.html"]');
  if (privacyLink) privacyLink.textContent = pageLabels(content).privacy;

  for (const [id, html] of Object.entries(renderSections(content))) {
    let section = document.getElementById(id);
    if (!section) {
      // An Optional module index.html has no place for yet: it goes at the
      // end of the page. Put an empty section into index.html to move it.
      if (html === "") continue;
      section = document.createElement("section");
      section.id = id;
      section.className = "section";
      document.querySelector("main").append(section);
    }
    section.innerHTML = html;
    section.hidden = html === "";
  }
} catch (error) {
  // Opening index.html straight from disk blocks fetch; a typo breaks the JSON.
  document.getElementById("bio").innerHTML = `
    <h1>The content could not be loaded</h1>
    <p>Open the site through a local web server, not by double-clicking index.html,
    and check that site/content.json is valid JSON.</p>`;
  console.error(error);
}
