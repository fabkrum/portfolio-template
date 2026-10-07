// Fills the page from the content file once it runs in the browser. A
// visitor's Chrome shows the name, the headline and the projects; a search
// engine or an AI agent, which runs no JavaScript, gets empty sections.
const content = await (await fetch("content.json")).json();
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
document.getElementById("bio").innerHTML = `<h1>${escape(content.name)}</h1><p class="headline">${escape(content.headline)}</p>`;
document.getElementById("projects").innerHTML = `<h2>Projects</h2><ul class="projects">${content.projects
  .map((project) => `<li class="project"><h3>${escape(project.title)}</h3><p>${escape(project.description)}</p></li>`)
  .join("")}</ul>`;
