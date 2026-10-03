# Design brief

Source: screenshot of a Stitch design
Mood: warm and approachable with a clear hierarchy; calm beige tones with a teal accent for calls to action.

## Colours

| Token | Light | Dark | Used for |
|---|---|---|---|
| background | #faf8f6 | #1a1815 | page background |
| surface | #ebe8e5 | #262420 | project cards, skill tags |
| text | #1a1614 | #ebe8e5 | headings and body text |
| muted | #4a4a4a | #a8a8a8 | headline under the name, dates, captions |
| accent | #1a5f57 | #5ab8ad | links, focus ring, buttons |
| on-accent | #ffffff | #1a1815 | text on an accent-coloured button |

## Type

| Role | Font | Size | Weight |
|---|---|---|---|
| headings | system-ui, sans-serif | name 2.5rem, section 1.5rem, card 1.125rem | 700 |
| body | system-ui, sans-serif | 1rem, line height 1.6 | 400 |

## Shapes

- Corner radius: 0.5rem on project cards, 0.5rem on buttons, fully round on skill tags.
- Borders: none; cards stand out by their surface colour alone.
- Shadows: none.

## Layout

- One column, at most 44rem wide, centred, with 1.25rem space at the sides on phones.
- 4rem between sections, 1.5rem between items in a list.
- Projects: two cards per row in a two-column grid; stacked on narrow screens.

## Components

- Links: accent colour, underlined; the underline disappears on hover, and keyboard focus shows a 2px accent ring.
- Project cards: surface background, 1.5rem inner space, title as a card heading, links to the code and live site at the bottom.
- Skill tags: surface background, small text, 0.25rem by 0.75rem inner space.
- Section headings: plain text in the heading font, no lines or icons.
