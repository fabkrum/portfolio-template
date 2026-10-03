# Portfolio template

Your own portfolio site, built with AI agents and published on GitHub Pages. The workshop guide walks you through every step; this page is the short version.

## Get your copy

1. Click **Use this template** → **Create a new repository**.
2. Name it `portfolio` and make it **Public**.
3. In your new repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and re-run the "Deploy to GitHub Pages" workflow (the first run fails until step 3 is done).

A few minutes later your site is live at `https://YOUR-USERNAME.github.io/portfolio/`. Until you add your own content it shows Ada Example, a fictional person.

## Check your site

From your repo folder, run:

```
node tools/check.mjs
```

It looks at your site in your own Chrome and reports each item as PASS or NEEDS ATTENTION: the content file matches the schema, accessibility (axe, the engine behind Lighthouse), no errors in the browser console, a privacy page, and no phone number or postal address in the content file. It only reports; it never stops you from publishing. It needs Node 22 or newer and Google Chrome.

## What is where

- `site/content.json` – all your content. Edit this file, not the HTML.
- `site/content.schema.json` – what the content file may contain.
- `site/` – the site itself: plain HTML, CSS and JavaScript, no build step.
- `tools/check.mjs` – the Check.
- `AGENTS.md` – the rules your agent follows.

Every push to `main` publishes the site again.

## Privacy

This repo is public. Never put your phone number or postal address in it.
