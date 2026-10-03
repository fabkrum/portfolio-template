# Portfolio template

Your own portfolio site, built with AI agents and published on GitHub Pages. The workshop guide walks you through every step; this page is the short version.

## Get your copy

1. Click **Use this template** → **Create a new repository**.
2. Name it `portfolio` and make it **Public**.
3. In your new repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and re-run the "Deploy to GitHub Pages" workflow (the first run fails until step 3 is done).

A few minutes later your site is live at `https://YOUR-USERNAME.github.io/portfolio/`. Until you add your own content it shows Ada Example, a fictional person.

## What is where

- `site/content.json` – all your content. Edit this file, not the HTML.
- `site/content.schema.json` – what the content file may contain.
- `site/` – the site itself: plain HTML, CSS and JavaScript, no build step.
- `AGENTS.md` – the rules your agent follows.

Every push to `main` publishes the site again.

## Privacy

This repo is public. Never put your phone number or postal address in it.
