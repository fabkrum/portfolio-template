# The five styles

The phrase bank for the person's Stitch prompt and their design brief. Copy the phrases as they are: they are written for Stitch, in English. Every font named here is in the folder `fonts/` of the repo, so the Stitch design and the site use the same fonts.

Each style has the same lines:

- **Offer**: how you offer it in the first question, with one example site.
- **More examples**: other sites in this style, if the person asks.
- **Phrase**: the style phrase for the prompt's Theme line.
- **Touch**: the cue for a mix, when this is the second style. Take one of the two.
- **Feel**: three words, for someone who skips question 2.
- **Fonts**: the prompt's fonts, and the font stacks for the brief's Type table.
- **Background**: the page background, and an accent for someone who names no colour.
- **Skills**, **Photo**, **Leave out**: for the prompt's Content, Image and Leave out lines.
- **Motion**: for the brief's Style section.
- **Signature**: moves from the signature menu that suit the style, each with its guide. The whole menu is in `.agents/skills/build/signatures.md`.
- **Brief**: the style's ready brief, in the folder `briefs/` next to this file, for a brief without Stitch.

## Classic

- Offer: **Classic**: serif headings, calm colours, a narrow reading column and fine lines. Like leerob.com.
- More examples: delba.dev
- Phrase: Quiet editorial, like a well-set book: narrow reading column, serif headings, hairline rules between sections, text links instead of buttons, no cards
- Touch: serif headings, or hairline rules
- Feel: calm, warm, precise
- Fonts: headings in Newsreader, text in Literata.
  - headings: `"Newsreader", Georgia, "Times New Roman", serif`
  - body: `"Literata", Georgia, "Times New Roman", serif`
  - details: `"Literata", Georgia, "Times New Roman", serif`
- Background: warm paper (#F7F3EC). Accent if they name no colour: ink red (#A8402F).
- Skills: as one plain comma-separated line
- Photo: Small portrait, may be greyscale
- Leave out: cards, shadows, pill tags, icons, gradients
- Motion: almost none: a quiet fade at most.
- Signature:
  - Typographic polish: `guides/visual-design/improve-text-layout-and-legibility.md`
  - Soft transition to the privacy page: `guides/ui-behaviors/cross-document-transitions.md`
  - Photo in an arch or circle: `guides/visual-design/complex-shapes.md`
- Brief: `briefs/classic.md`

## Modern

- Offer: **Modern**: a clean sans-serif, one accent colour, lists instead of boxes, lots of space and subtle motion. Like emilkowal.ski.
- More examples: paco.me
- Phrase: Minimal and precise: flush-left single column, clean sans-serif, borderless lists instead of boxes, lots of whitespace, thin dividers, muted grey secondary text
- Touch: lots of whitespace, or borderless lists
- Feel: quiet, precise, clear
- Fonts: headings and text in Geist, dates in JetBrains Mono.
  - headings: `"Geist", system-ui, sans-serif`
  - body: `"Geist", system-ui, sans-serif`
  - details: `"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`
- Background: soft white (#FAFAF9). Accent if they name no colour: deep green (#0E7C66).
- Skills: as a plain list in muted grey
- Photo: Small round avatar
- Leave out: hero banner, big buttons, shadowed cards, gradients, glassmorphism
- Motion: subtle and short: things settle into place, nothing bounces.
- Signature:
  - Staggered entrance on load: `guides/ui-behaviors/dynamic-sibling-animations.md`
  - Sections appear on scroll: `guides/ui-behaviors/scroll-entry-exit-effects.md`
  - Soft transition to the privacy page: `guides/ui-behaviors/cross-document-transitions.md`
- Brief: `briefs/modern.md`

## Bold

- Offer: **Bold**: a huge name, oversized type, strong colour blocks and a cut-out photo. Like tej.as.
- More examples: cydstumpel.nl
- Phrase: Bold and poster-like: name set huge across the full width, oversized condensed headings, flat colour blocks, split-screen sections, sharp corners, high contrast
- Touch: name set huge, or colour blocks
- Feel: confident, direct, loud
- Fonts: headings in Anton, text in Work Sans.
  - headings: `"Anton", Impact, "Arial Narrow", sans-serif`
  - body: `"Work Sans", system-ui, sans-serif`
  - details: `"Work Sans", system-ui, sans-serif`
- Background: bone (#F2EFE8). Accent if they name no colour: tomato red (#E5432D), which fills behind dark text; the brief darkens it to #B8301C for text.
- Skills: as one big line of words, no boxes
- Photo: Cut-out portrait on a colour block
- Leave out: rounded cards, soft shadows, small headings, gradients
- Motion: confident and quick: big things move once, then stay.
- Signature:
  - Reading progress line: `guides/ui-atoms/scroll-progress-indicator.md`
  - Header shrinks on scroll: `guides/ui-atoms/shrinking-header-on-scroll.md`
  - Sections appear on scroll: `guides/ui-behaviors/scroll-entry-exit-effects.md`
- Brief: `briefs/bold.md`

## Playful

- Offer: **Playful**: rounded shapes, bright colours, stickers and badges, small animations. Like joshwcomeau.com.
- More examples: cassidoo.co
- Phrase: Playful and friendly: rounded shapes, pill buttons, bright flat colours on cream, sticker badges with thick dark outlines and hard offset shadows, small hand-drawn doodles, wavy dividers
- Touch: sticker badges, or rounded shapes
- Feel: friendly, curious, cheerful
- Fonts: headings in Bricolage Grotesque, text in Rubik.
  - headings: `"Bricolage Grotesque", system-ui, sans-serif`
  - body: `"Rubik", system-ui, sans-serif`
  - details: `"Rubik", system-ui, sans-serif`
- Background: warm cream (#FFF8EC). Accent if they name no colour: bright orange (#FF6A2B), which fills behind dark text; the brief darkens it to #C2410C for text.
- Skills: as tilted stickers
- Photo: Portrait in a rounded blob frame
- Leave out: corporate blue, glassmorphism, neon glow, gradients
- Motion: small and springy, on hover and keyboard focus.
- Signature:
  - Stickers with a spring: `guides/ui-behaviors/physics-based-easing.md`
  - Event badges pop in: `guides/ui-behaviors/animate-element-entry-exit.md`
  - Photo in an arch or circle: `guides/visual-design/complex-shapes.md`
- Brief: `briefs/playful.md`

## Technical

- Offer: **Technical**: monospace details, a dot or grid pattern, metadata like in a code editor. Like antfu.me.
- More examples: brittanychiang.com
- Phrase: Technical and precise: dot-grid background, monospace labels and code-editor-style metadata (file names, dates, languages), clean sans-serif body, 1px borders, square corners, one syntax-colour accent
- Touch: monospace dates, or dot-grid background
- Feel: exact, nerdy, honest
- Fonts: headings in JetBrains Mono, text in IBM Plex Sans.
  - headings: `"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`
  - body: `"IBM Plex Sans", system-ui, sans-serif`
  - details: `"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`
- Background: cool white (#F6F7F9). Accent if they name no colour: syntax green (#1A7F37).
- Skills: as a monospace list, like an array
- Photo: Small square portrait
- Leave out: neon glow, purple-blue gradients, fake terminal stats
- Motion: crisp and functional: state changes, no decoration.
- Signature:
  - Other cards step back on hover and focus: `guides/css/child-state-based-styling.md`
  - Theme switch as an opening circle: `guides/ui-behaviors/same-document-transitions.md`
  - Navigation marks the current section: `guides/ui-components/scrollspy.md`
- Brief: `briefs/technical.md`

## A mix of two

The first style is the style. From the second, take exactly one cue, its **Touch**. Fonts, background, skills, photo, leave-out list and motion come from the first style. Example: "Playful, with a Technical touch: monospace dates".

## The personal detail

A hobby, place or object of the person's becomes exactly one small detail, never a whole design. Choose one of five kinds, the one that fits the style best:

| Kind | Example |
|---|---|
| an icon | climbing: a small pixel-art climber next to the name, as the logo |
| a background pattern | chess: a faint checkerboard behind the header |
| a frame for the photo | Venice: the photo in an arch, like a Venetian window |
| a divider | the sea: thin wavy lines between the sections |
| the accent colour | espresso: a deep espresso brown as the accent |

Three rules:

- A kind the style leaves out is out: Classic leaves out icons, so a Classic detail is a pattern, a frame, a divider or the colour.
- A frame needs a `photo` in the content file. Without one, choose another kind.
- The accent colour is the detail only when question 3 gave no colour: the person's own colour comes first.

Describe it in a few words the Developer can build with CSS or a small drawing: no photo of the hobby, no illustration that needs an artist.
