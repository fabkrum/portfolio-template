// Loads the content file and fills every section of the page from it.
import { renderSections } from "./render.js";

async function loadContent() {
  const response = await fetch("content.json");
  if (!response.ok) throw new Error(`content.json: HTTP ${response.status}`);
  return response.json();
}

try {
  const content = await loadContent();
  document.documentElement.lang = content.language ?? "en";
  document.title = `${content.name} · Portfolio`;

  for (const [id, html] of Object.entries(renderSections(content))) {
    const section = document.getElementById(id);
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
