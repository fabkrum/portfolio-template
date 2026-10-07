# Design brief

Source: the interview, without Stitch
Mood: exact, nerdy, honest. Technical and precise, like a code editor: monospace details on a dot grid.

## Style

- Style: Technical.
- Feel: exact, nerdy, honest.
- Personal detail: none.
- Motion: crisp and functional: state changes, no decoration. When the visitor prefers reduced motion, nothing moves.

## Colours

| Token | Light | Dark | Used for |
|---|---|---|---|
| background | #f6f7f9 | #0d1117 | page background: cool white, with a faint dot grid |
| surface | #f1f3f6 | #161b22 | cards |
| text | #161b22 | #e6edf3 | headings and body text |
| muted | #57606a | #9198a1 | dates, labels, file names, borders |
| accent | #1a7f37 | #3fb950 | links, focus ring: syntax green |
| on-accent | #ffffff | #0d1117 | text on an accent-coloured button |

## Type

| Role | Font | Size | Weight |
|---|---|---|---|
| headings | "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace | name 2rem, section 1.125rem, project 1rem | 600 |
| body | "IBM Plex Sans", system-ui, sans-serif | 1rem, line height 1.6 | 400 |
| details | "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace | dates and labels 0.875rem | 400 |

## Shapes

- Corner radius: none: square corners, the photo too.
- Borders: 1px in the muted colour thinned out, around cards.
- Shadows: none.

## Layout

- One column, at most 46rem, centred, with 1.25rem space at the sides on phones; a faint dot grid behind the page.
- 3rem between sections, 1rem between items in a list.
- Projects: cards with a 1px border, two columns from 40rem.

## Components

- Links: accent colour, underlined; keyboard focus shows a 2px accent ring.
- Projects: surface background, 1px border, 1.25rem inner space, the title in the heading font.
- Skills: a monospace list written like an array: [ "HTML", "CSS" ].
- Section headings: in the heading font, with "// " before them as decoration.

## Signature

- Move: Other cards step back on hover and focus
- Guide: guides/css/child-state-based-styling.md
- Where: the projects: while one is pointed at or focused, the others step back.

## Sections

1. `bio`: the name, the headline and the bio.
2. `projects`: the goal is a job, so the projects lead.
3. `links`: GitHub, LinkedIn and email.
4. `cv`: experience, education and skills.
