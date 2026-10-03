---
name: modern-web-guidance
description: Current best practices for HTML, CSS and JavaScript from the Chrome team, stored in this repo. Your training data is older than today's web platform; read the matching guide before you choose how to build any part of the page (colours, dark mode, layout, fonts, images, accessibility, performance).
---

# Modern Web Guidance

You learned web development from data that stops at your training cutoff. The web platform kept moving since then. These guides describe how to build things with today's HTML, CSS and JavaScript. They are stored in this folder, so you need no internet and no tool to read them.

## How to use the guides

1. Open `index.md` in this folder. It lists every guide by topic, one line each, with what the guide covers.
2. Pick the guides that match what you are about to build. Open them from this folder, for example `guides/visual-design/dark-mode.md`.
3. Build it the way the guide says. Where a guide marks a feature as not yet widely supported, use the fallback the guide gives.
4. Before you finish, compare your code with the guides you read once more.

Never invent a guide that is not in `index.md`. If no guide matches, build it the plain, standard way.

## The rules of this repo come first

`AGENTS.md` wins over any guide. The site is plain HTML, CSS and JavaScript with no build step and no npm packages, and it loads nothing from other servers. Skip any advice that needs a framework, a package, a build tool, or a file from another server (a font CDN, for example).

The guides are copied unchanged from Modern Web Guidance by GoogleChrome, under the Apache License 2.0. See `NOTICE` and `LICENSE` in this folder.
