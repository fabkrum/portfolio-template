# Design brief

Source: the interview, without Stitch
Mood: friendly, curious, cheerful. Playful and friendly: rounded shapes, bright colours and stickers.

## Style

- Style: Playful.
- Feel: friendly, curious, cheerful.
- Personal detail: none.
- Motion: small and springy, on hover and keyboard focus. When the visitor prefers reduced motion, nothing moves.

## Colours

| Token | Light | Dark | Used for |
|---|---|---|---|
| background | #fff8ec | #1e1711 | page background: warm cream |
| surface | #fef0da | #2b2119 | cards and stickers |
| text | #2a1b10 | #fcefdf | headings, body text, outlines, hard shadows |
| muted | #6b5644 | #c9b298 | headline under the name, dates |
| accent | #c2410c | #ff9a5c | links, focus ring, buttons: orange |
| on-accent | #ffffff | #1e1711 | text on an accent-coloured button |

## Type

| Role | Font | Size | Weight |
|---|---|---|---|
| headings | "Bricolage Grotesque", system-ui, sans-serif | name clamp(2.5rem, 6vw, 4rem), section 1.75rem, project 1.25rem | 800 |
| body | "Rubik", system-ui, sans-serif | 1.0625rem, line height 1.6 | 400 |
| details | "Rubik", system-ui, sans-serif | dates 0.875rem | 500 |

## Shapes

- Corner radius: 1.25rem on cards, fully round on buttons and stickers; the photo in a rounded blob.
- Borders: 2px in the text colour around cards and stickers.
- Shadows: hard offset shadows, 4px down and right with no blur, in the text colour.

## Layout

- One column, at most 48rem, centred, with 1.25rem space at the sides on phones.
- 4rem between sections, with a wavy line between them; 1.5rem between items in a list.
- Projects: rounded cards with the sticker outline, two columns from 40rem.

## Components

- Links: accent colour, with a thick underline; keyboard focus shows a 3px accent ring.
- Projects: surface background, 2px outline, hard shadow, 1.5rem inner space.
- Skills: stickers: surface background, 2px outline, fully round, each tilted a little.
- Section headings: in the heading font, weight 800.

## Signature

- Move: Stickers with a spring
- Guide: guides/ui-behaviors/physics-based-easing.md
- Where: the skill stickers wobble and grow a little on hover.

## Sections

1. `bio`: the name, the headline and the bio.
2. `projects`: the goal is a job, so the projects lead.
3. `links`: GitHub, LinkedIn and email.
4. `cv`: experience, education and skills.
