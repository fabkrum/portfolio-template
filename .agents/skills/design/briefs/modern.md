# Design brief

Source: the interview, without Stitch
Mood: quiet, precise, clear. Minimal and precise, like a good product: lists instead of boxes, and lots of space.

## Style

- Style: Modern.
- Feel: quiet, precise, clear.
- Personal detail: none.
- Motion: subtle and short, 150 to 300 ms: things settle into place, nothing bounces. When the visitor prefers reduced motion, nothing moves.

## Colours

| Token | Light | Dark | Used for |
|---|---|---|---|
| background | #fafaf9 | #111211 | page background: soft white |
| surface | #f1f1ef | #1b1c1b | the rare box, code |
| text | #1b1b1a | #ececea | headings and body text |
| muted | #5f5f5b | #a1a19c | secondary text, dates, section headings, dividers |
| accent | #0e7c66 | #4fd1ae | links on hover, focus ring: deep green |
| on-accent | #ffffff | #111211 | text on an accent-coloured button |

## Type

| Role | Font | Size | Weight |
|---|---|---|---|
| headings | "Geist", system-ui, sans-serif | name 1.5rem, section 1rem, project 1rem | 600 |
| body | "Geist", system-ui, sans-serif | 1rem, line height 1.6 | 400 |
| details | "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace | dates and labels 0.875rem | 400 |

## Shapes

- Corner radius: none on lists; 0.375rem only where something must look clickable; the photo is round.
- Borders: thin dividers between list items, 1px in the muted colour thinned out.
- Shadows: none.

## Layout

- One column, at most 40rem wide, centred, text flush left, with 1.25rem space at the sides on phones.
- 5rem between sections, 1rem between items in a list.
- Projects: a borderless list, one below the other; no cards and no columns.

## Components

- Links: text colour, underlined in the muted colour; the accent on hover, and keyboard focus shows a 2px accent ring.
- Projects: the title, one line of description in the muted colour, then the links in a row.
- Skills: a plain list in the muted colour, separated by middle dots.
- Section headings: small, in the heading font, in the muted colour.
- Dates: in the details font, in the muted colour.

## Signature

- Move: Staggered entrance on load
- Guide: guides/ui-behaviors/dynamic-sibling-animations.md
- Where: the parts of the bio settle into place one after the other when the page opens.

## Sections

1. `bio`: the name, the headline and the bio.
2. `projects`: the goal is a job, so the projects lead.
3. `links`: GitHub, LinkedIn and email.
4. `cv`: experience, education and skills.
