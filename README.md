# Portfolio template

Your own portfolio site, built with AI agents and published on GitHub Pages. The workshop guide walks you through every step; this page is the short version.

## Get your copy

1. Click **Use this template** → **Create a new repository**.
2. Name it `portfolio` and make it **Public**.
3. In your new repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and re-run the "Deploy to GitHub Pages" workflow (the first run fails until step 3 is done).

A few minutes later your site is live at `https://YOUR-USERNAME.github.io/portfolio/`. Until the Analyst role adds your own content it shows Ada Example, a fictional person.

## Set up your laptop

Paste one line into a terminal and press Enter. It asks for your GitHub username.

**macOS** (Terminal):

```
curl -fsSL https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.sh | sh
```

**Linux** (Terminal):

```
wget -qO- https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.sh | sh
```

**Windows** (PowerShell):

```
irm https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.ps1 | iex
```

It checks Google Chrome and Antigravity IDE, installs Git and Node where they are missing, downloads Chrome DevTools for agents, puts your repo in a `portfolio` folder in your home folder and opens it in Antigravity IDE. Whatever it cannot do itself, it tells you in plain words, with what to do next. Run it again any time; it only does what is still missing.

## Preview your site

From your repo folder, run:

```
node tools/preview.mjs
```

It builds your site and prints a local address such as `http://localhost:8000`. Open it in Chrome to see your site before you publish it. After a change, reload the page: the preview builds your site again first. Press Ctrl+C to stop the preview.

## Build your site

The preview, the Check, look and publishing build your site by themselves, so you rarely need this. To see the finished files, run from your repo folder:

```
node tools/build.mjs
```

It puts your content from `site/content.json` into the pages and writes the finished site into the folder `_site/`: each page with its title, description and link preview, and `robots.txt`, `llms.txt` and `sitemap.xml` for search engines and AI agents. The sitemap needs your site's address, which the build takes from your repo on GitHub. Your content is in the pages themselves, so they show it without JavaScript. It uses only what comes with Node: no npm packages.

## Check your site

From your repo folder, run:

```
node tools/check.mjs
```

It builds your site, looks at it in your own Chrome and reports each item as PASS or NEEDS ATTENTION: the content file matches the schema, accessibility (the axe rules behind Lighthouse's accessibility score), no errors in the browser console, what an agent sees (your name, headline and projects in the page itself, for search engines and AI agents that run no JavaScript), and the legal page written for your site: its legal notice, privacy notice and accessibility statement, linked from the footer. The legal page needs attention until the Developer has written it with `node tools/legal.mjs`. It only reports; it never stops you from publishing. It needs Node 22 or newer and Google Chrome.

## Your legal page

From your repo folder, run:

```
node tools/legal.mjs
```

It writes `site/privacy.html`, the page the footer links as "Legal notice & privacy": a legal notice with your name and email address from `site/content.json`, and your postal address, phone number and VAT number if the content file has them, a privacy notice for a personal portfolio in the EU without tracking, and an accessibility statement. It is in English; the Developer role runs it and translates the page if your site is in another language. It is a template, not legal advice: if you sell services through the site or run it as a business, check it with someone who knows the law in your country. Run it again whenever the legal part of your content file changes.

## Look at your site

From your repo folder, run:

```
node tools/look.mjs
```

It builds your site and saves screenshots of every page at phone and wide width, in light and dark mode, into the folder `qa/`, and tells you how fast the home page shows up on a phone with a slow connection (LCP) and whether it jumps while it loads (CLS). The QA role uses it; you can open the screenshots too.

## Chrome DevTools for agents

Chrome DevTools for agents is a set of tools from the Chrome team that lets your agent work in Chrome: open your site, take screenshots, record how fast it loads and run a Lighthouse audit. This repo switches it on for your agent in `.agents/mcp_config.json`, and the Install script downloads it ahead of time. Antigravity IDE asks you before each of these tools runs: read what the agent wants to do, then allow it. The QA role uses them when they are there; without them, QA works too.

## Publish your site

Every push to `main` builds your site and publishes it through GitHub Actions. The Ops role does it for you. It also runs once a day, so what depends on the date, such as which of your events are coming up, stays right. To see whether the newest version is online, run from your repo folder:

```
node tools/live.mjs
```

It prints your site's address and waits up to two minutes until the site online matches your last commit. If the site does not show up at all, it walks you through the one-time GitHub Pages setting.

## Fell behind?

The room works through the roles together, one block per role. When time is up for a block and you are not done, jump to that block's checkpoint, and you start the next block with the room. From your repo folder, run this with the role of the block that has just ended, `analyst`, `designer`, `developer`, `qa` or `ops`. When the Developer's time is up, that is:

```
node tools/checkpoint.mjs developer
```

Use the block that has just ended, not the one that starts now. It brings your site to the end of that block and keeps your own content file, design brief and spec. If you have none, it puts in the sample person, the default design brief and the sample spec. From the Developer's checkpoint on, your site takes the colours and fonts of your design brief, and your legal page is written. It tells you what it kept and what it changed, and which role to ask for next, in a fresh chat. It is the same command on every system and needs no Git. You can also ask your agent to do it for you.

## Add more sections

Once your site is live, you can add Optional modules: a section for YouTube videos, podcasts, a blog, resources or project ideas. Start a fresh chat and ask to add one; the `portfolio-add-module` skill asks you for the entries and writes them into `site/content.json`. The section shows up below your CV. The same skill adds widgets: events with your talks, certifications, a Now list, numbers, or a project told as a case study. Each shows up in its own place on the page.

## What is where

- `site/content.json` – all your content. Edit this file, not the HTML.
- `site/content.schema.json` – what the content file may contain.
- `docs/spec.md` – a short spec of your site: who it is for and what a visitor should do. The Analyst role writes it, with your content file.
- `design/brief.md` – your design brief: style, colours, fonts, shapes, layout, the one signature move and the order of the sections. It starts as the default design, in the Classic style; the Designer role interviews you and replaces it with yours from Stitch.
- `design/default-brief.md` – that default design, kept so you can always go back to it.
- `fonts/` – two openly licensed fonts for each of the five styles, with their licences. The ones your design brief names are copied into your site.
- `site/` – the site itself: plain HTML, CSS and JavaScript.
- `tools/build.mjs` – the build: puts your content into the pages and writes the finished site into `_site/`.
- `_site/` – the finished site, built from `site/`: what the preview shows. It is not in Git; the build makes it again every time, also on GitHub before it publishes.
- `tools/preview.mjs` – the preview.
- `tools/look.mjs` – screenshots and load speed, for QA.
- `tools/live.mjs` – your site's address, and whether the newest version is online.
- `tools/check.mjs` – the Check.
- `tools/check-content.mjs` – checks the content file: does it match the schema.
- `tools/check-brief.mjs` – checks the design brief: every section there, every colour readable on its background.
- `tools/contrast.mjs` – says whether a colour is readable as text on a background.
- `tools/fonts.mjs` – copies the fonts your design brief names from `fonts/` into your site.
- `tools/photo.mjs` – makes a small square copy of your photo for the site, without the hidden data a phone saves in a photo: `node tools/photo.mjs my-photo.jpg`.
- `tools/legal.mjs` – writes your legal page, `site/privacy.html`, from your content file.
- `tools/checkpoint.mjs` – jumps to a checkpoint.
- `tools/where.mjs` – which roles are done and which comes next. Ask your agent "Where am I?" and it runs it for you.
- `checkpoints/` – one checkpoint per block of the workshop: the repo at the end of that block. `checkpoints/README.md` explains them.
- `.agents/skills/` – one skill per role, plus `portfolio-add-module` for Optional modules, `legal` for changes to your legal page later, `checkpoint` for catching up, and `help`, `explain` and `recap` for when you are stuck, want something explained, or want the story of your site written down. Antigravity IDE finds them when you open the repo.
- `.agents/skills/modern-web-guidance/` – Modern Web Guidance by the Chrome team: current best practices the Developer reads before building. Stored in the repo, so nothing is downloaded.
- `.agents/mcp_config.json` – switches on Chrome DevTools for agents for your agent in Antigravity IDE.
- `install.sh`, `install.ps1` – the Install script for macOS/Linux and for Windows.
- `workshop.json` – the event of your workshop, if you set up your laptop with the line from the workshop guide: the Install script saves it, and the Analyst adds the event to your site. It stays on your laptop: it is not in Git.
- `AGENTS.md` – the rules your agent follows.

Every push to `main` builds and publishes the site again.

## Public

This repo and your site are public: anyone can read every file, and Git keeps old versions. What your site shows, a phone number or an address included, is your choice.
