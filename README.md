# Portfolio template

Your own portfolio site, built with AI agents and published on GitHub Pages. The workshop guide walks you through every step; this page is the short version.

## Get your copy

1. Click **Use this template** → **Create a new repository**.
2. Name it `portfolio` and make it **Public**.
3. In your new repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and re-run the "Deploy to GitHub Pages" workflow (the first run fails until step 3 is done).

A few minutes later your site is live at `https://YOUR-USERNAME.github.io/portfolio/`. Until you add your own content it shows Ada Example, a fictional person.

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

## Check your site

From your repo folder, run:

```
node tools/check.mjs
```

It looks at your site in your own Chrome and reports each item as PASS or NEEDS ATTENTION: the content file matches the schema, accessibility (the axe rules behind Lighthouse's accessibility score), no errors in the browser console, a privacy page, and no phone number or postal address in the content file. It only reports; it never stops you from publishing. It needs Node 22 or newer and Google Chrome.

## What is where

- `site/content.json` – all your content. Edit this file, not the HTML.
- `site/content.schema.json` – what the content file may contain.
- `site/` – the site itself: plain HTML, CSS and JavaScript, no build step.
- `tools/check.mjs` – the Check.
- `install.sh`, `install.ps1` – the Install script for macOS/Linux and for Windows.
- `AGENTS.md` – the rules your agent follows.

Every push to `main` publishes the site again.

## Privacy

This repo is public. Never put your phone number or postal address in it.
