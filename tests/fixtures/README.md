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
  `legal-page-without-accessibility`, `footer-without-legal-link`,
  `phone-link-calls-another-number` and `phone-in-content-differs-from-legal-page`
  each break one rule of the legal page (#27): its three parts, the footer
  link to it, and a phone link that calls the number the page shows and the
  content file gives. Phone numbers and addresses on the site are the
  person's choice, so no fixture flags them any more.
- `base` in any `fixture.json` names another fixture folder, relative to this
  one, that is laid over `site/` first. The Check's fixtures stand on
  `finished-privacy/`: the legal page (legal notice, privacy notice and
  accessibility statement) the template in `tools/legal/` gives for Ada
  Example, as `node tools/legal.mjs` writes it, dated 4 October 2026, so that
  only the planted problem needs attention.
- `clean-sites/` – the same, for sites that must pass every item: tricky but
  harmless content (dates, ISBNs, "Corso di Laurea"), and `contact-details-shown`,
  a person who shows a phone link, a postal address and a VAT number, with the
  legal page `node tools/legal.mjs` writes for them.
- Until 2026-10-08 a sixth role, the Lawyer, wrote the legal page in a block
  of its own, between QA and Ops. Since then `node tools/legal.mjs` writes it
  at the end of the Developer's step and QA checks it; the Lawyer's checkpoint
  and its proxy runs (`lawyer-runs/`, `checkpoint-runs/lawyer/`) are gone.
  Reports of runs from before that day still speak of the Lawyer, as the
  agent did then; they were not recorded again.
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
  default brief of that day, kept as `design/old-default-brief.md` (the
  default brief is in the Classic style since 2026-10-07); `stitch-web-font`
  used the brief from
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
- `qa-runs/` – the QA skill in a proxy run (2026-10-04), the same way as
  above. `before/` is the site the agent was given: the `default-brief` built
  site with planted problems, faint dates (`.period` at half opacity, an
  accessibility finding) and the grid on `#projects` instead of `.projects`,
  so the heading takes a column of its own, which the Check cannot see.
  `after/` holds the files the run changed, laid over `before/`; `report.md`
  holds what the agent told the person, and what its earlier rounds changed.
  The run used the QA skill's wording of 2026-10-04, from before the legal
  page became the Developer's: its legal page is still the placeholder.
- `analyst-runs/` – the Analyst skill in proxy runs on 2026-10-04, the same
  way, with the person's side played turn by turn from a fixed answer sheet.
  One folder per way in: `linkedin/` (fake LinkedIn text, `input.txt`), `cv/`
  (a fake CV, `cv.pdf`, printed from `cv.html` with headless Chrome) and
  `interview/` (nothing to start from). Each input or answer sheet carries a
  phone number and address of zeros and placeholders. The runs are from before
  #27 (2026-10-08): the skill then told the person not to type them and left
  them out, which their reports still show. Since #27 a phone number goes on
  the site when the person wants calls, and an address belongs on the legal
  page; the runs were not recorded again, and their tests no longer ask that
  the planted data is left out. `answers.md` is
  what the person answered, `report.md` everything the agent wrote in the chat,
  `spec.md` the spec it wrote and `site/` the content file it wrote, laid over
  the `default-brief` built site. Each content file must match the schema and
  pass every item of the Check but the legal page, which the Developer writes
  later with `node tools/legal.mjs`. All three runs
  used the skill's wording of 2026-10-04, in the fifth round; `report.md`
  notes what the earlier rounds changed.
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
  as `today`, so the split into upcoming and past events stays the same. With
  the workshop it has `builtAt`, the event of the colophon line, as the
  Analyst adds both from `workshop.json`: the sample person was built at no
  event, so the tests of the colophon line use this one.
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
  the wording of 2026-10-04; `report.md` notes what the earlier rounds
  changed. Since #27 the skill no longer leaves a phone number out, so the
  podcast run's choice to drop one is no longer tested.
- `checkpoint-runs/` – the checkpoint skill in a proxy run on 2026-10-04, the
  same way as the Analyst runs: a person who fell behind asks the agent to
  catch them up. `developer/` is Giulia Placeholder with the Italian content
  of `analyst-runs/cv`, the brief `design/briefs/from-stitch-html.md` and a
  stylesheet her agent left half written; she names the checkpoint, and then
  asks for the next role in the same chat. `before/` holds what her repo held
  on top of the template, `after/` every file that differed once the run was
  over, and `report.md` the chat and every tool call the agent made. The
  agent had the text of AGENTS.md loaded as its rules, as Antigravity loads
  it. It is the ninth round; `report.md` notes what the earlier rounds
  changed, and the Lawyer run that went with it until 2026-10-08. The files
  the Developer's checkpoint writes follow that checkpoint: they are made
  again with the command itself whenever the checkpoint changes. They are
  Giulia's `index.html`, `assets/styles.css` and, since the checkpoint writes
  the legal page too, `privacy.html` in `developer/after/site/`. On
  2026-10-07 the checkpoint moved to the Classic default design with its
  fonts, and got the round photo, the colophon line and the styles of the
  widgets. The test of what the command says leaves out the legal page's
  lines, which the run of 2026-10-04 did not have.
- `deploy-run/` – the Ops skill in a proxy run on 2026-10-04. The repo was the
  template, committed and pushed once, with the Developer's work and the legal
  page (then the Lawyer's) not committed yet and a stray `My CV.pdf` in
  `docs/`, next to the spec. Its GitHub
  address led to a bare repo on disk, and `tools/live.mjs` looked at a local
  stand-in for GitHub Pages that answered 404 until the person had switched
  Pages on. `pushed.txt` lists the commits that reached the stand-in GitHub
  after the template's own, newest first, with the files of each; `report.md`
  is what the agent told the person. It is the fifth round; `report.md` notes
  what the earlier ones changed.
