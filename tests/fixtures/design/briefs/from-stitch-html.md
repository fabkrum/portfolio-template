# Design brief

Source: Stitch HTML
Mood: professional and modern, with warm earthy tones and generous breathing room; the work speaks for itself.

## Colours

| Token | Light | Dark | Used for |
|---|---|---|---|
| background | #f7f5f0 | #10201e | page background |
| surface | #ece7dc | #1a2e2b | project cards, skill tags |
| text | #1c1917 | #f5f5f4 | headings and body text |
| muted | #57534e | #a8a29e | headline under the name, dates, captions |
| accent | #095f59 | #5eead4 | links, focus ring, buttons |
| on-accent | #ffffff | #1c1917 | text on an accent-coloured button |

## Type

| Role | Font | Size | Weight |
|---|---|---|---|
| headings | "Plus Jakarta Sans", system-ui, sans-serif | name 3rem, section 1.5rem, card 1.125rem | 700 for display, 500 for body headings |
| body | "Plus Jakarta Sans", system-ui, sans-serif | 1rem, line height 1.5 | 400 |

## Shapes

- Corner radius: 0.75rem on project cards, 9999px (fully round) on buttons, 9999px on skill tags.
- Borders: 1px solid on the header top, colours from token palette.
- Shadows: none.

## Layout

- One column, at most 56rem wide, centred, with 1.5rem space at the sides on phones.
- 3rem between sections, 1.5rem between items in a list.
- Projects: one card per project, stacked on phones; side by side in two columns from 40rem screen width.

## Components

- Links: accent colour, underlined; the underline disappears on hover.
- Project cards: surface background, 1.5rem inner space, title as a card heading, links to the code and live site at the bottom.
- Skill tags: surface background, small text, fully round pills.
- Section headings: plain text in the heading font, no lines or icons.
