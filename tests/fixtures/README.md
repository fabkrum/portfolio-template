# Test fixtures

All data here is fake. Phone numbers are zeros, at most after a country
code; addresses and dates of birth are invented placeholders. Never put real
ones in: this repo is public.

- `invalid-content/` – content files the schema must reject.
- `broken-sites/` – one folder per broken site for the Check. Each holds only
  the files that differ from the sample site in `site/`, plus a `fixture.json`:
  `expect` names the one Check item that must need attention, `finding` is
  text its report must contain, `remove` lists sample files to delete. The
  tests lay the folder over a copy of `site/`; the Check builds it, as
  publishing does. `content-only-in-javascript` is a site whose content only
  appears through JavaScript: its `assets/render.js` gives the build nothing
  to put into the page, and its `assets/main.js` fills the page from
  `content.json` in the browser. A visitor's Chrome shows the content; a
  search engine or an AI agent, which runs no JavaScript, does not.
  `photo-with-location/assets/me.jpg` is a small JPEG made in Chrome with the
  hidden data a phone saves planted into it by `tests/photos.js`: a camera
  name and the GPS position 0° N 0° E, a place in the sea.
- `base` in any `fixture.json` names another fixture folder, relative to this
  one, that is laid over `site/` first. The Check's fixtures stand on
  `finished-privacy/`: the privacy page the Lawyer's template gives for Ada
  Example, so that only the planted problem needs attention.
- `clean-sites/` – the same, for sites with tricky but harmless content (dates,
  ISBNs, "Corso di Laurea") that must pass every item.
- `design/` – a made-up Stitch export of a fictional person and a screenshot of
  it, the two inputs the Designer skill accepts. `design/briefs/` holds the
  briefs the skill wrote from each in a proxy run on 2026-10-03: a fresh
  agent on Claude Haiku 4.5, standing in for the smallest Gemini Flash, with
  only the template, AGENTS.md and the skill. They must stay ready for the
  Developer.
- `built-sites/` – sites the Developer skill built in proxy runs on 2026-10-04,
  the same way: a fresh agent on Claude Haiku 4.5 with only the template,
  AGENTS.md and the skills. Each folder holds the files the run changed in
  `site/`, laid over the sample site, and a `fixture.json` whose `brief` names
  the brief it built from. `default-brief` is the sample content with the
  default brief; `stitch-web-font` used the brief from
  `tests/fixtures/design/briefs/from-stitch-html.md`, with the Plus Jakarta Sans files a
  participant downloads from Google Fonts already in `assets/fonts/` (SIL Open
  Font License, `OFL.txt` beside them). Each must pass the Check, define the
  brief's six colours with `light-dark()` and load nothing from other servers.
  The `index.html` of `default-brief` is the template's with the run's one
  change, a colour-scheme meta tag, so it follows the template's `index.html`:
  since 2026-10-07 it has the empty colophon line in the footer.
- `look-sites/` – sites for `tools/look.mjs`, each laid over the
  `default-brief` built site: one that jumps while it loads, one wider than a
  phone screen, and three layout mistakes the Check cannot see. The grid on
  `#projects` puts the heading beside the cards; `cards-in-half-width` is a
  QA proxy run's half fix of that (the heading spans the grid, the cards stay
  in its first column); `sections-touching` removes the space between sections.
- `qa-runs/` and `lawyer-runs/` – the QA and Lawyer skills in proxy runs on
  2026-10-04, the same way as above. `before/` is the site the agent was
  given: the `default-brief` built site with planted problems. For QA, faint
  dates (`.period` at half opacity, an accessibility finding) and the grid on
  `#projects` instead of `.projects`, so the heading takes a column of its own,
  which the Check cannot see. For the Lawyer, a phone number (the Check finds
  it) and a birth date (it does not) in the content file, and the template's
  placeholder privacy page. `after/` holds the files the run changed, laid over
  `before/`; `report.md` holds what the agent told the person. Both runs used
  the final wording of the skills.
- `analyst-runs/` – the Analyst skill in proxy runs on 2026-10-04, the same
  way, with the person's side played turn by turn from a fixed answer sheet.
  One folder per way in: `linkedin/` (fake LinkedIn text, `input.txt`), `cv/`
  (a fake CV, `cv.pdf`, printed from `cv.html` with headless Chrome) and
  `interview/` (nothing to start from). Each input or answer sheet carries a
  planted phone number and address of zeros and placeholders. `answers.md` is
  what the person answered, `report.md` everything the agent wrote in the chat,
  `spec.md` the spec it wrote and `site/` the content file it wrote, laid over
  the `default-brief` built site. Each content file must match the schema, hold
  none of the planted data and pass every item of the Check but the Lawyer's
  privacy page. All three runs used the final wording of the skill, in the
  fifth round; `report.md` notes what the earlier rounds changed.
- `clean-sites/all-optional-modules/` – the sample content with entries for
  all five Optional modules (videos, podcasts, blog posts, resources, project
  ideas). Video IDs such as `EXAMPLE0001` and every `example.com` address are
  made up.
- `clean-sites/all-widgets/` – the sample content with every widget: numbers,
  Now, four events (the workshop of DevFest Milano as an attendee, a talk
  ahead, past talks and a panel, a meetup online), four certifications (one
  from an exam, one expired, a course and a workshop), and the first project
  as a case study with a made-up screenshot, `assets/tide-tables.svg`. Every
  event, issuer and `example.com` address is made up; the tests pass the day
  as `today`, so the split into upcoming and past events stays the same.
- `module-runs/` – the Optional-module skill in proxy runs on 2026-10-04, the
  same way as the Analyst runs: one folder per recipe, with `answers.md`,
  `report.md` and in `site/` the content file the agent wrote, laid over the
  site it started from (the `default-brief` built site; for `ideas`, the
  Italian content of `analyst-runs/cv`). The answers plant what the skill must
  handle: an `http://` link, a request to embed the YouTube player, a phone
  number in a podcast answer, dates written out in words, and an Italian site
  whose new heading and entries must be in Italian. In each run the content
  file was the only file the agent changed. `sample-content.json` is the
  sample person's content file of the day of the runs, which four of them
  started from; the sample has grown since. All five are the third round, on
  the final wording; `report.md` notes what the earlier rounds changed.
- `checkpoint-runs/` – the checkpoint skill in proxy runs on 2026-10-04, the
  same way as the Analyst runs: a person who fell behind asks the agent to
  catch them up. `developer/` is Giulia Placeholder with the Italian content
  of `analyst-runs/cv`, the brief `design/briefs/from-stitch-html.md` and a
  stylesheet her agent left half written; she names the checkpoint. `lawyer/`
  is Luca Esempio with the content of `analyst-runs/linkedin`, the default
  brief, the Developer's checkpoint and a privacy page with blanks left; he
  does not say where the room is. In both, the person then asks for the next
  role in the same chat. `before/` holds what their repo held on top of the
  template, `after/` every file that differed once the run was over, and
  `report.md` the chat and every tool call the agent made. The agent had the
  text of AGENTS.md loaded as its rules, as Antigravity loads it. The files
  the Developer's checkpoint writes, `index.html` and `assets/styles.css` in
  `developer/after/site/` and `lawyer/before/site/`, follow that checkpoint:
  they were made again with the command itself on 2026-10-07, when the
  checkpoint got the round photo and the colophon line. Both runs
  are the ninth round, on the final wording; `report.md` notes what the
  earlier rounds changed.
- `deploy-run/` – the Ops skill in a proxy run on 2026-10-04. The repo was the
  template, committed and pushed once, with the Developer's and the Lawyer's
  work not committed yet and a stray `My CV.pdf` in `docs/`, next to the spec. Its GitHub
  address led to a bare repo on disk, and `tools/live.mjs` looked at a local
  stand-in for GitHub Pages that answered 404 until the person had switched
  Pages on. `pushed.txt` lists the commits that reached the stand-in GitHub
  after the template's own, newest first, with the files of each; `report.md`
  is what the agent told the person. It is the fifth round; `report.md` notes
  what the earlier ones changed.
