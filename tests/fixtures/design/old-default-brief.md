# Design brief

Source: the default brief that ships with the template (no Stitch design).
Mood: calm and clear, plenty of white space; the person's content is the hero, not the decoration.

## Colours

| Token | Light | Dark | Used for |
|---|---|---|---|
| background | #ffffff | #121216 | page background |
| surface | #f4f4f6 | #1c1c22 | project cards, skill tags |
| text | #1b1b1f | #ececf1 | headings and body text |
| muted | #5a5a66 | #a8a8b3 | headline under the name, dates, captions |
| accent | #1a56db | #8fb2ff | links, focus ring, the one button |
| on-accent | #ffffff | #121216 | text on an accent-coloured button |

## Type

| Role | Font | Size | Weight |
|---|---|---|---|
| headings | system-ui, sans-serif | name 2.5rem, section 1.5rem, card 1.125rem | 700 |
| body | system-ui, sans-serif | 1rem, line height 1.6 | 400 |

## Shapes

- Corner radius: 0.75rem on project cards, 0.5rem on buttons, fully round on skill tags.
- Borders: none; cards stand out by their surface colour alone.
- Shadows: none.

## Layout

- One column, at most 44rem wide, centred, with 1.25rem space at the sides on phones.
- 4rem between sections, 1.5rem between items in a list.
- Projects: one card per project, stacked; side by side in two columns from 40rem screen width.

## Components

- Links: accent colour, underlined; the underline disappears on hover, and keyboard focus shows a 2px accent ring.
- Project cards: surface background, 1.5rem inner space, title as a card heading, links to the code and the live site at the bottom.
- Skill tags: surface background, small text, 0.25rem by 0.75rem inner space.
- Section headings: plain text in the heading font, no lines or icons.
