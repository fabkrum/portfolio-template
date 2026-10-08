---
name: recap
description: Writes docs/recap.md, the story of the person's portfolio Role by Role, with what each Role produced and the decisions it made and why, taken from the spec, the design brief, the git log and the legal page, and then two or three things to learn next. Reads the summary back. Writes only docs/recap.md. Use when the person says "Write down what we did and why", "recap", or asks for a summary of what they built and why.
---

# Recap

You write down what the person built and why, so they can read it again next week. You write exactly one file, `docs/recap.md`, and change nothing else.

## 1. Collect the facts

Run these two commands, one after the other. They are the same on every operating system, and they change nothing:

```
node tools/where.mjs
```

```
git --no-pager log --stat site design docs
```

The first says which Roles are done. The second lists every commit with its date and the files it changed in `site/`, `design/` and `docs/`; if Git is not set up, leave out what only it can tell. Then read `docs/spec.md`, `design/brief.md`, `site/content.json` and `site/privacy.html`.

## 2. Write docs/recap.md

Start with a title and one line: whose portfolio it is, and today's date. Then one `##` section per Role, in order: what the Role produced, as files, and the decisions it made, each with its reason. Where to find them:

- **Analyst**: `docs/spec.md`. Who the site is for, what a visitor should do, the language, the sections, and what was left out on purpose and why.
- **Designer**: `design/brief.md`. Where the design came from (Stitch or the default), the mood, the colours and the fonts.
- **Developer**: `site/assets/styles.css` in the colours and fonts of the brief, and the rules for the site in `AGENTS.md`: plain HTML, CSS and JavaScript, the content built into the pages so search engines and AI agents can read them, nothing loaded from other servers, and why.
- **QA**: what it checks (the look, accessibility, speed on a phone), and its screenshots in `qa/` if there are any.
- **Lawyer**: the legal page, `site/privacy.html`: its legal notice, what its privacy notice promises (no cookies, no tracking, nothing from other servers) and its accessibility statement.
- **Ops**: the commits in the log, with their dates and files.

A Role that `node tools/where.mjs` does not list as done gets one line: "Not done yet." Write only what the files and the log say: never make up a reason, and where none is written down, leave out the why. The repo is public, so no phone number, no postal address, nothing private.

End with `## What to learn next`: two or three points, each tied to this site and to a file to start from. For example: how the site switches to dark mode, in `.agents/skills/modern-web-guidance/guides/visual-design/dark-mode.md`.

## 3. Read it back

Tell the person in a few lines what the recap says, Role by Role, and that it is in `docs/recap.md` in their repo. It becomes public with their next publish, like the spec. Ask whether anything is wrong or missing, and change only `docs/recap.md`.
