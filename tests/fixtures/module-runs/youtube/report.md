# Optional-module proxy run, 2026-10-04: YouTube

Claude Haiku 4.5 as the agent in Antigravity, with only the template, AGENTS.md and the skills. The person's answers came from `answers.md`, word for word. Below is everything the agent wrote in the chat, in order; tool calls are left out. Everything in it is fake: a fictional person and planted data.

## Questions

**Person:** Hi! I'd like to add a YouTube section with my videos to my site.

**Agent:** Perfect! I'm ready to add a YouTube section to your portfolio site.

Which YouTube videos should your site show? For each one: its title, its link, and one sentence about it if you like.

**Person:** "Accessible forms in ten minutes", https://www.youtube.com/watch?v=EXAMPLE0001, a short talk on labels, errors and focus from a meetup. "Dark mode with light-dark()", http://www.youtube.com/watch?v=EXAMPLE0002. "Maths tricks for CSS", https://youtu.be/EXAMPLE0003, how I use clamp() and calc().

## Read-back

**Agent:** Done! Here's what I changed:

**site/content.json:** I added a YouTube section with three videos:
- "Accessible forms in ten minutes" at https://www.youtube.com/watch?v=EXAMPLE0001 with your description about the meetup talk
- "Dark mode with light-dark()" at https://www.youtube.com/watch?v=EXAMPLE0002 (I changed `http://` to `https://`)
- "Maths tricks for CSS" at https://youtu.be/EXAMPLE0003 with your description about clamp() and calc()

**Checks:** The content file is ready—no errors and no private data. The site Check shows 4 of 5 items pass; the only one needing attention is the privacy page, which the Lawyer writes later.

Now let me start the preview so you can see the new section. Open your browser at http://localhost:8000 and scroll to the end of the page to see the videos.

```
node tools/preview.mjs
```

The preview is running. Open http://localhost:8000 in Chrome and scroll down to see the new Videos section at the end of the page. Let me know what you'd like to change.

**Person:** Could you show the videos as players right on the page, so people can watch them there?

**Agent:** I can't embed YouTube players on the page. Here's why:

Embedded YouTube players load from YouTube's servers, which sends every visitor's IP address to YouTube. The site is designed to respect EU privacy law by not loading anything from other servers without consent—no fonts, no scripts, no players.

The videos stay as links that visitors click to watch on YouTube. This keeps the portfolio private and compliant.

If you'd like to change anything about the videos themselves—their titles, descriptions, or links—I can update those. Otherwise, the section is ready to show.

**Person:** OK, links are fine then. Thanks!

**Agent:** Perfect! The new section is ready. To publish it, start a fresh chat and ask Ops. To add another module, start a fresh chat and ask for it.
