# Rules for the agent

You help a beginner build their own portfolio site. They lead, you do the work. Follow these rules in every chat.

## Work role by role

The site is built by six roles, always in this order. Each role has a skill in `.agents/skills/`: read its `SKILL.md` and follow it, step by step.

1. **Analyst** (skill `analyst`) – collects the person's content into `site/content.json` and writes a short spec in `docs/spec.md`.
2. **Designer** (skill `design`) – interviews them about their style, writes their prompt for Stitch and turns their Stitch design into the design brief in `design/brief.md`.
3. **Developer** (skill `build`) – builds the site from `site/content.json` and `design/brief.md`.
4. **QA** (skill `qa`) – audits accessibility and performance and fixes what it finds.
5. **Lawyer** (skill `legal`) – adds the privacy page and removes private data.
6. **Ops** (skill `deploy`) – publishes the site by pushing to GitHub.

- Do only the role the person asked for. Never jump ahead to a later role, even if it looks helpful.
- One role per chat. When a role is finished, tell the person to start a fresh chat for the next role. A fresh chat keeps your context clean.
- **Optional modules** come after the six roles: a section for YouTube videos, podcasts, a blog, resources or project ideas, added with the skill `portfolio-add-module`. One module per chat. When the person asks to add a section or something more to their site, that is this skill.

## Fell behind? Checkpoints

The room works through the roles together, one block per role. When the person fell behind, is lost or wants to catch up, or asks for a checkpoint, use the skill `checkpoint`. It runs one command, with the role whose block the room has just finished, that brings the site to the end of that block and keeps the person's own content file, design brief and spec:

```
node tools/checkpoint.mjs developer
```

Never catch up by doing a role's work yourself, and never use Git to go back or forward: the checkpoint is the one way to catch up. Asking for "the Developer checkpoint" is not asking for the Developer.

The command's output is the read-back: it says in plain words, file by file, what it kept, what it changed and what needs attention. Reply with all of it, copied word for word into a text block. Do not retell it in your own words, and add nothing to it.

A checkpoint is a chat of its own. After it, the person starts a fresh chat for the next role. If they ask you for that role, or any other, in the same chat, do not start it: tell them again to start a fresh chat.

## Stuck, curious or done?

- "Where am I?", "What's next?" or "I'm stuck": use the skill `help`.
- "Explain … to me": use the skill `explain`.
- "Write down what we did and why": use the skill `recap`.

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

- The site is plain HTML, CSS and JavaScript in `site/`. One build tool turns it into the finished site: `node tools/build.mjs` (the same command on every system) puts the content of `site/content.json` into the pages and writes the finished site into `_site/`. It uses only what comes with Node: never add npm packages, a `package.json` or another build tool. The preview, look, the Check and publishing build the site themselves.
- JavaScript is only for extras, never for content. The content is in the page itself, so it shows without JavaScript, and search engines and AI agents read it. Never load `site/content.json` in the browser.
- All content lives in `site/content.json`, which must match `site/content.schema.json`. Change content there, not in the HTML. That includes the page's own words, such as section headings, in the site's language: they are the `labels` in the content file.
- The repo is public. Never put a phone number or a postal address in any file.
- A photo of the person goes on the site only through `node tools/photo.mjs <file>` (the same command on every system): it saves a small square copy as `site/assets/photo.webp`, without the hidden data a phone saves in a photo, such as where it was taken. Never put the original photo into `site/`.
- Load nothing from other servers: no fonts from fonts.googleapis.com, no scripts or styles from a CDN. A web font goes into `site/assets/fonts/` and is loaded from there. Loading it from Google would send every visitor's IP address to Google, which EU privacy law does not allow without consent.
- See whether the published site is live with `node tools/live.mjs` (the same command on every system). It prints the site's address on GitHub Pages and waits until the site online matches the last commit.
- Preview the site with `node tools/preview.mjs` (the same command on every system). It builds the site and prints a local address to open in Chrome; after a change, reload the page.
- Before choosing how to build any part of the page, read the matching guide in Modern Web Guidance, `.agents/skills/modern-web-guidance/`. Your training data is older than today's web.
- Look at the site with `node tools/look.mjs` (the same command on every system). It saves screenshots of every page at phone and wide width, in light and dark mode, into `qa/`, and measures how fast the home page loads on a phone. Open the screenshots and look at them: the Check cannot see the layout.
- Check the site with `node tools/check.mjs` (the same command on every system). The Check is a tool next to the site, not part of it: it uses Node, the site never does. It reports what passes and what needs attention and never blocks; read its findings back to the person in plain words.
