# Vendored code

Stored in the repo so nothing is downloaded in the room.

- `axe-core/axe.min.js` — [axe-core](https://github.com/dequelabs/axe-core) 4.13.0 by Deque Systems, unmodified, under the Mozilla Public License 2.0 (`axe-core/LICENSE`, third-party notices in `axe-core/LICENSE-3RD-PARTY.txt`). It is the accessibility engine behind Lighthouse's accessibility audits.
- `.agents/skills/modern-web-guidance/guides/` — the guides of [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) by GoogleChrome, unmodified, under the Apache License 2.0 (`LICENSE` and `NOTICE` in that folder). They sit in the skills folder so Antigravity IDE finds them. `modern-web-guidance.mjs` here copies a new version in and rewrites its `index.md`; the steps are at the top of the script.
