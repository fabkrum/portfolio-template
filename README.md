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

It checks Google Chrome and Antigravity IDE, installs Git and Node where they are missing, puts your repo in a `portfolio` folder in your home folder and opens it in Antigravity IDE. Whatever it cannot do itself, it tells you in plain words, with what to do next. Run it again any time; it only does what is still missing.

## Preview your site

From your repo folder, run:

```
node tools/preview.mjs
```

It prints a local address such as `http://localhost:8000`. Open it in Chrome to see your site before you publish it. Press Ctrl+C to stop the preview.

## Check your site

From your repo folder, run:

```
node tools/check.mjs
```

It looks at your site in your own Chrome and reports each item as PASS or NEEDS ATTENTION: the content file matches the schema, accessibility (the axe rules behind Lighthouse's accessibility score), no errors in the browser console, a privacy page written for your site, and no phone number or postal address anywhere in the site. The privacy page needs attention until the Lawyer role has written it. It only reports; it never stops you from publishing. It needs Node 22 or newer and Google Chrome.

## Look at your site

From your repo folder, run:

```
node tools/look.mjs
```

It saves screenshots of every page at phone and wide width, in light and dark mode, into the folder `qa/`, and tells you how fast the home page shows up on a phone with a slow connection (LCP) and whether it jumps while it loads (CLS). The QA role uses it; you can open the screenshots too.

## What is where

- `site/content.json` – all your content. Edit this file, not the HTML.
- `site/content.schema.json` – what the content file may contain.
- `docs/spec.md` – a short spec of your site: who it is for and what a visitor should do. The Analyst role writes it, with your content file.
- `design/brief.md` – your design brief: colours, fonts, shapes and layout. It starts as a plain default design; the Designer role replaces it with yours from Stitch.
- `design/default-brief.md` – that default design, kept so you can always go back to it.
- `site/` – the site itself: plain HTML, CSS and JavaScript, no build step.
- `tools/preview.mjs` – the preview.
- `tools/look.mjs` – screenshots and load speed, for QA.
- `tools/check.mjs` – the Check.
- `tools/check-content.mjs` – checks the content file: does it match the schema, and is there no phone number or postal address in it.
- `tools/check-brief.mjs` – checks the design brief: every section there, every colour readable on its background.
- `.agents/skills/` – one skill per role. Antigravity IDE finds them when you open the repo.
- `.agents/skills/modern-web-guidance/` – Modern Web Guidance by the Chrome team: current best practices the Developer reads before building. Stored in the repo, so nothing is downloaded.
- `install.sh`, `install.ps1` – the Install script for macOS/Linux and for Windows.
- `AGENTS.md` – the rules your agent follows.

Every push to `main` publishes the site again.

## Privacy

This repo is public. Never put your phone number or postal address in it.
