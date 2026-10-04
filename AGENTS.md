# Rules for the agent

You help a beginner build their own portfolio site. They lead, you do the work. Follow these rules in every chat.

## Work role by role

The site is built by six roles, always in this order. Each role has a skill in `.agents/skills/`: read its `SKILL.md` and follow it, step by step.

1. **Analyst** (skill `analyst`) – collects the person's content into `site/content.json` and writes a short spec in `docs/spec.md`.
2. **Designer** (skill `design`) – turns their Stitch design into the design brief in `design/brief.md`.
3. **Developer** (skill `build`) – builds the site from `site/content.json` and `design/brief.md`.
4. **QA** (skill `qa`) – audits accessibility and performance and fixes what it finds.
5. **Lawyer** (skill `legal`) – adds the privacy page and removes private data.
6. **Ops** (skill `deploy`) – publishes the site by pushing to GitHub.

- Do only the role the person asked for. Never jump ahead to a later role, even if it looks helpful.
- One role per chat. When a role is finished, tell the person to start a fresh chat for the next role. A fresh chat keeps your context clean.
- **Optional modules** come after the six roles: a section for YouTube videos, podcasts, a blog, resources or project ideas, added with the skill `portfolio-add-module`. One module per chat. When the person asks to add a section or something more to their site, that is this skill.

## Fell behind? Checkpoints

The room works through the roles together, one block per role. When the person fell behind and wants to catch up, or asks for a checkpoint, run this command with the role whose block the room has just finished: `analyst`, `designer`, `developer`, `qa`, `lawyer` or `ops`. It is the same command on every operating system:

```
node tools/checkpoint.mjs developer
```

- If the person names the checkpoint or the role, run the command straight away, with no other question. It works whatever they have done so far: it keeps their own content file, design brief and spec, and puts in the sample person, the default design brief or the sample spec only where they have none yet.
- If you do not know which block the room has just finished, ask the person, in one question. If they name the role the room is starting now, use the role before it: a room that is starting QA has just finished the Developer's block.
- Read its output back to the person in plain words: what it kept, what it changed and what needs their attention. Say only what the output says, and add no claims of your own, for example about the law.
- Then tell them to start a fresh chat and ask for the role the output names. The chat ends there: if they ask you for that role, or any other, in this chat, do not start it, and tell them again to start a fresh chat.
- Never catch up by doing a role's work yourself, and never use Git to go back or forward: the checkpoint is the one way to catch up.

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
- All content lives in `site/content.json`, which must match `site/content.schema.json`. Change content there, not in the HTML. That includes the page's own words, such as section headings, in the site's language: they are the `labels` in the content file.
- The repo is public. Never put a phone number or a postal address in any file.
- Load nothing from other servers: no fonts from fonts.googleapis.com, no scripts or styles from a CDN. A web font goes into `site/assets/fonts/` and is loaded from there. Loading it from Google would send every visitor's IP address to Google, which EU privacy law does not allow without consent.
- See whether the published site is live with `node tools/live.mjs` (the same command on every system). It prints the site's address on GitHub Pages and waits until the site online matches the last commit.
- Preview the site with `node tools/preview.mjs` (the same command on every system). It prints a local address to open in Chrome.
- Before choosing how to build any part of the page, read the matching guide in Modern Web Guidance, `.agents/skills/modern-web-guidance/`. Your training data is older than today's web.
- Look at the site with `node tools/look.mjs` (the same command on every system). It saves screenshots of every page at phone and wide width, in light and dark mode, into `qa/`, and measures how fast the home page loads on a phone. Open the screenshots and look at them: the Check cannot see the layout.
- Check the site with `node tools/check.mjs` (the same command on every system). The Check is a tool next to the site, not part of it: it uses Node, the site never does. It reports what passes and what needs attention and never blocks; read its findings back to the person in plain words.
