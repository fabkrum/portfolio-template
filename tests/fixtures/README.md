# Test fixtures

All data here is fake. Phone numbers are zeros, addresses are invented
placeholders; never put real ones in, this repo is public.

- `invalid-content/` – content files the schema must reject.
- `broken-sites/` – one folder per broken site for the Check. Each holds only
  the files that differ from the sample site in `site/`, plus a `fixture.json`:
  `expect` names the one Check item that must need attention, `finding` is
  text its report must contain, `remove` lists sample files to delete. The
  tests lay the folder over a copy of `site/`.
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
