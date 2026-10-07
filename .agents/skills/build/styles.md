# The five styles

The brief's Style section names one of five styles, or two. Build the page with that style's recipe below. The brief's colours, fonts and sizes win where they are more precise than the recipe: the recipe fills in what the brief leaves open.

## Rules for every style

- **Colours**: only the brief's six tokens, through `var(--name)`. For a faint line or pattern you may thin a token out, as in `color-mix(in srgb, var(--muted) 30%, transparent)`; never for text.
- **A mix of two**: the first style is the style. From the second, build only the one cue the brief names, such as "monospace dates".
- **The photo**, when the content file has one: round by default, with `border-radius: 50%`. A style may change its shape, as its recipe says.
- **The personal detail** in the brief's Style section: build exactly one, small, with CSS or a small SVG file in `site/assets/`:
  - an icon: an SVG file, shown with `mask` and `background: var(--accent)` so it follows the colours, `aria-hidden` or with empty alt text: it is decoration.
  - a background pattern: CSS gradients, very faint, behind one area only, such as the header.
  - a frame for the photo: `border-radius`, `clip-path` or `mask`.
  - a divider: a line between the sections, made with a border or a background gradient.
  - the accent colour: nothing to build, it is in the tokens.
- **Sections**: the brief's Sections list gives their order, top to bottom. Put the empty sections of `site/index.html` in that order. A section the list names that `index.html` lacks gets an empty `<section id="ID" class="section"></section>` at its place.
- **What look checks**, so each style must keep it: every section is one below the other, with at least 2rem of margin between them, outside any line at a section's top; each section's heading sits above its content, never beside it; the lists and paragraphs of a section are as wide as the section; nothing is wider than a phone screen. A split screen goes inside a section, below its heading.

## The AI look: never by default

Pages an AI builds unasked all look the same. None of these, unless the brief asks for it:

- indigo, violet or purple, and gradients of them
- Inter, or another font the brief does not name
- everything centred: headings, text and cards
- `rounded-lg` everywhere: the same medium radius on every box
- three cards in a row, each with an icon on top
- emoji as section markers or icons
- a bento grid of boxes in different sizes
- a glow that follows the cursor, glassmorphism, neon
- a pulsing "available" dot
- made-up numbers, skill bars and percentages

## Classic

Quiet editorial, like a well-set book. Like leerob.com and delba.dev.

- **Type**: serif headings in a medium weight (500 to 600), a reading serif for the text. Name about 2.75rem, section headings 1.5rem, project titles 1.25rem; text 1.0625rem with a line height of 1.65. The headline under the name in the heading font's italic. Numbers in the text with `font-variant-numeric: oldstyle-nums`.
- **Spacing**: 4rem between sections, with the hairline in between, 1.5rem between items.
- **Shapes**: no corner radius, no shadows, no cards. Hairline rules: 1px lines in a thinned `--muted`.
- **Layout**: one narrow column, at most 38rem, centred, text flush left. A hairline above every section after the first. Projects as a list, one below the other, each separated by a hairline: title, one sentence, then text links.
- **Colour**: calm. The accent only for links and the focus ring; links underlined, with the underline a little away from the text (`text-underline-offset: 0.2em`).
- **Skills**: one plain line, separated by commas: `.skills li:not(:last-child)::after { content: ","; }`.
- **Photo**: small, about 6rem, round or in an arch; greyscale with `filter: grayscale(1)` when the brief says so.
- **Motion**: almost none. A quiet fade at most.
- **Avoid**: cards, shadows, pill-shaped tags, icons, gradients, more than one accent.

## Modern

Minimal and precise, like a good product. Like emilkowal.ski and paco.me.

- **Type**: one clean sans-serif. Few sizes: name about 1.5rem in weight 600, section headings 1rem in weight 600, text 1rem with a line height of 1.6. Hierarchy comes from weight and the muted colour, not from size. Dates and labels in the brief's details font, a monospace, at 0.875rem.
- **Spacing**: lots of it: 5rem between sections, 1rem between items.
- **Shapes**: borderless. Thin dividers (1px, thinned `--muted`) between list items, small radius (0.375rem) only where something must look clickable.
- **Layout**: one column, at most 40rem, centred, flush left. Projects as a list, not boxes: the title, one muted line below it, the links in a row; dates to the right on wide screens.
- **Colour**: grey on near-white; the one accent sparingly, for links on hover and the focus ring. Secondary text in `--muted`.
- **Skills**: a plain list in `--muted`, separated by spaces or a middle dot.
- **Photo**: a small round avatar, about 3rem, beside or above the name.
- **Motion**: subtle and short, 150 to 300 ms, ease-out: things settle into place, nothing bounces.
- **Avoid**: a hero banner, big buttons, shadowed cards, gradients, glassmorphism.

## Bold

Confident and poster-like. Like tej.as and cydstumpel.nl.

- **Type**: the name huge, set across the width: `font-size: clamp(3rem, 12vw, 8rem)` with a line height of 0.9, in the condensed heading font, often in capitals. Look at it at phone width: `overflow-wrap: break-word` keeps a long name on the screen. Section headings oversized too, `clamp(2.25rem, 6vw, 4rem)`. Text 1.125rem with a line height of 1.6.
- **Spacing**: tight inside a block, wide between blocks: 4rem between sections.
- **Shapes**: sharp corners, no radius. Thick borders (2 to 3px) in `--text`. No soft shadows.
- **Layout**: a wide column, up to 72rem. Flat colour blocks: one block, such as the bio, in `--accent` with `--on-accent` text and generous padding. A split screen inside a section: two halves side by side from 48rem, below the section's heading. Projects in two columns from 40rem, as flat blocks with a thick border.
- **Colour**: high contrast. Blocks of the accent, text on them in `--on-accent`.
- **Skills**: one big line of words in the heading font, no boxes.
- **Photo**: a cut-out portrait on a block of `--accent`, square, offset a little inside the block.
- **Motion**: confident and quick: big things move once, then stay.
- **Avoid**: rounded cards, soft shadows, small headings, gradients.

## Playful

Friendly, bright and a little silly. Like joshwcomeau.com and cassidoo.co.

- **Type**: a heading font with character, weight 700 to 800: name about `clamp(2.5rem, 6vw, 4rem)`, section headings 1.75rem. Text 1.0625rem with a line height of 1.6.
- **Spacing**: generous and airy: 4rem between sections.
- **Shapes**: rounded corners (1rem to 1.5rem), pill-shaped buttons and tags. Stickers: a thick dark outline (`2px solid var(--text)`) and a hard offset shadow (`box-shadow: 4px 4px 0 var(--text)`).
- **Layout**: one column, at most 48rem. Projects as rounded cards with the sticker outline, two columns from 40rem. Wavy dividers between sections, made with a CSS mask.
- **Colour**: bright and flat, on cream. Blocks of the accent with `--on-accent` text.
- **Skills**: stickers, each tilted a little: `rotate: -2deg`, and `2deg` on every second one.
- **Photo**: in a rounded blob frame, such as `border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%`.
- **Motion**: small and springy, on hover and keyboard focus.
- **Avoid**: corporate blue, glassmorphism, neon glow, gradients.

## Technical

Nerdy and exact, like a code editor. Like antfu.me and brittanychiang.com.

- **Type**: headings in the monospace, weight 500 to 700: name about 2rem, section headings 1.125rem. Text in the sans-serif, 1rem with a line height of 1.6. Dates, labels and file names in the monospace, 0.875rem.
- **Spacing**: even and regular, on a 0.5rem grid: 3rem between sections.
- **Shapes**: square corners, 1px borders in a thinned `--muted`.
- **Layout**: one column, at most 46rem. A dot grid behind the page: `background-image: radial-gradient(color-mix(in srgb, var(--muted) 30%, transparent) 1px, transparent 1px); background-size: 1.25rem 1.25rem;`. Code-editor metadata as decoration, such as `// ` before each section heading: write `content: "// ";` and then `content: "// " / "";`, so screen readers skip it where browsers know the second form. Projects as cards with a 1px border, two columns from 40rem.
- **Colour**: one syntax colour as the accent, the rest greys.
- **Skills**: a monospace list written like an array, `[ "HTML", "CSS" ]`, with the brackets and commas as decoration in `::before` and `::after`, given the same `/ ""` as the heading decoration.
- **Photo**: a small square portrait with a 1px border.
- **Motion**: crisp and functional: state changes, no decoration.
- **Avoid**: neon glow, purple and blue gradients, fake terminal output and made-up stats.
