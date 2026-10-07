# Design brief

Source: the interview, without Stitch
Mood: confident, direct, loud. Bold and poster-like: a huge name, oversized type and flat colour blocks.

## Style

- Style: Bold.
- Feel: confident, direct, loud.
- Personal detail: none.
- Motion: confident and quick: big things move once, then stay. When the visitor prefers reduced motion, nothing moves.

## Colours

| Token | Light | Dark | Used for |
|---|---|---|---|
| background | #f2efe8 | #141210 | page background: bone |
| surface | #e6e1d6 | #221e1a | the blocks behind the projects |
| text | #15120f | #f4f0e8 | headings, body text, borders |
| muted | #5c554b | #b3aa9b | headline under the name, dates |
| accent | #b8301c | #ff8466 | links, the colour block of the bio: tomato red |
| on-accent | #ffffff | #141210 | text on the colour block |

## Type

| Role | Font | Size | Weight |
|---|---|---|---|
| headings | "Anton", Impact, "Arial Narrow", sans-serif | name clamp(3rem, 12vw, 8rem), section clamp(2.25rem, 6vw, 4rem), project 1.5rem, in capitals | 400 |
| body | "Work Sans", system-ui, sans-serif | 1.125rem, line height 1.6 | 400 |
| details | "Work Sans", system-ui, sans-serif | dates 0.875rem, in capitals | 600 |

## Shapes

- Corner radius: none: sharp corners everywhere, the photo too.
- Borders: thick, 3px in the text colour, around the projects.
- Shadows: none.

## Layout

- A wide column, at most 72rem, with 1.25rem space at the sides on phones.
- 4rem between sections, 1.5rem between items in a list.
- The bio as a colour block: the accent behind on-accent text, with 2rem inner space.
- Projects: flat blocks with a thick border, two columns from 40rem.

## Components

- Links: underlined, 2px thick, in the accent colour; on the colour block in the on-accent colour. Keyboard focus shows a 3px ring in the text colour, on the colour block in the on-accent colour.
- Projects: surface background, 3px border in the text colour, 1.5rem inner space, the title in the heading font.
- Skills: one big line of words in the heading font, no boxes.
- Section headings: oversized, in capitals.

## Signature

- Move: Reading progress line
- Guide: guides/ui-atoms/scroll-progress-indicator.md
- Where: a thin accent line at the top of the window, as the visitor reads.

## Sections

1. `bio`: the name, the headline and the bio.
2. `projects`: the goal is a job, so the projects lead.
3. `links`: GitHub, LinkedIn and email.
4. `cv`: experience, education and skills.
