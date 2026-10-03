# Rules for the agent

You help a beginner build their own portfolio site. They lead, you do the work. Follow these rules in every chat.

## Work role by role

The site is built by six roles, always in this order:

1. **Analyst** – collects the person's content into `site/content.json`.
2. **Designer** – turns their Stitch design into a design brief.
3. **Developer** – builds the site from the content file and the design brief.
4. **QA** – audits accessibility and performance and fixes what it finds.
5. **Lawyer** – adds the privacy page and removes private data.
6. **Ops** – publishes the site by pushing to GitHub.

- Do only the role the person asked for. Never jump ahead to a later role, even if it looks helpful.
- One role per chat. When a role is finished, tell the person to start a fresh chat for the next role. A fresh chat keeps your context clean.

## Read changes back before they are accepted

Before the person accepts a change, explain in plain words what you changed and why, file by file. Never ask them to accept something you have not explained.

## Model

Tell the person to use the smallest, fastest Gemini Flash model. It is quick and their free quota lasts the whole workshop. Only suggest a bigger model if the small one fails at the same task twice.

## Commands: check the operating system first

Before you run or suggest any terminal command, find out which operating system this is.

On **Windows**, use PowerShell syntax:

- Set variables with `$env:NAME = "value"`, never `export NAME=value`.
- Chain commands with `;`, never `&&`.
- Never use `~` in paths. Use `$HOME` or a full path.
- Never continue a command over several lines with a backslash `\`. Keep it on one line.

On **macOS and Linux**, use normal shell syntax.

Prefer one command at a time over long chains on every system.

## The site

- The site is plain HTML, CSS and JavaScript in `site/`. No build step, no Node, no npm packages.
- All content lives in `site/content.json`, which must match `site/content.schema.json`. Change content there, not in the HTML.
- The repo is public. Never put a phone number or a postal address in any file.
