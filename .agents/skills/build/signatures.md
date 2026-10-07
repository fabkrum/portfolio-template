# The signature menu

Every site gets exactly one signature move: the one in the brief's Signature section. It is the detail people remember. Each move below names the site it comes from and the Modern Web Guidance guide to read first, in `.agents/skills/modern-web-guidance/`. Read that guide before you write its code: the move works because the guide is newer than your training data. Where a guide's advice needs a package, a build tool or a file from another server, skip that advice: `AGENTS.md` wins.

## Rules for every move

- **Reduced motion.** When the visitor prefers reduced motion (`prefers-reduced-motion: reduce`), the move becomes a fade, or nothing moves. Put the motion inside `@media (prefers-reduced-motion: no-preference)`.
- **Never hidden.** Content is never hidden: not by default, not while it waits for an animation, not in a browser that lacks the feature. Without the move, the page is complete.
- **No faded text when the page loads.** The Check measures contrast as the page loads, and text that is still see-through then fails it. Move text with `translate` or `scale`; fade only decorations. Things that animate on scroll show their starting state in the full-page screenshots of `node tools/look.mjs`, so keep that state close to the final one.
- **Keyboard and screen readers.** What happens on hover also happens on keyboard focus (`:focus-visible`, `:focus-within`). A button is a `<button>`. Decoration gets `aria-hidden="true"`, or lives in a pseudo-element.
- **JavaScript only where the guide needs it**, in a small module of its own in `site/assets/`, loaded with `<script type="module">` in the `<head>`, like `main.js`. Words it shows come from the page itself, so they stay in the site's language.
- **Nothing stored.** The site sets no cookies and stores nothing on the visitor's device; the privacy page says so.

## Theme switch as an opening circle

Like antfu.me. Guide: `guides/ui-behaviors/same-document-transitions.md`

- A button switches between light and dark mode, and the new colours open as a circle from where it was pressed: `document.startViewTransition()`, and a `clip-path: circle()` animation on `::view-transition-new(root)`.
- The switch sets `color-scheme: light` or `color-scheme: dark` on the root element; the colour tokens follow, because they use `light-dark()`. It starts from the visitor's own setting and keeps the choice only while the page is open.
- The button is a real `<button>` with `aria-pressed`, a label in the site's language (take it from the page's `lang`), and a visible focus ring.
- Reduced motion: the colours switch at once, no circle.

## Soft transition to the privacy page

Like shud.in and cydstumpel.nl. Guide: `guides/ui-behaviors/cross-document-transitions.md`

- Going from the home page to the privacy page and back cross-fades instead of flashing: `@view-transition { navigation: auto; }` in the stylesheet both pages share. CSS only.
- Reduced motion: put the rule inside `@media (prefers-reduced-motion: no-preference)`, so the pages change at once.

## Sections appear on scroll

Like nerdy.dev and cydstumpel.nl. Guide: `guides/ui-behaviors/scroll-entry-exit-effects.md`

- As a section's content scrolls into view, it slides up a little: a scroll-driven animation with `animation-timeline: view()` and `animation-range: entry`, inside `@supports`. CSS only.
- Move it a short way, such as `translate: 0 1.5rem` to `0`. Never start it see-through.
- Reduced motion: nothing moves.

## Reading progress line

Like tej.as. Guide: `guides/ui-atoms/scroll-progress-indicator.md`

- A thin line in the accent colour at the top of the window grows from left to right as the visitor reads: `animation-timeline: scroll()`. It can be `body::before`, so the page needs no extra markup; as an element of its own it gets `aria-hidden="true"`.
- Reduced motion: no line.

## Header shrinks on scroll

Like ishadeed.com. Guide: `guides/ui-atoms/shrinking-header-on-scroll.md`

- As the visitor starts to scroll, the name at the top shrinks into a small title and stays at the top while the bio is in view: `position: sticky` on the name (it sticks within the bio, its section) and a scroll-driven `scale` with `animation-timeline: scroll()` and `animation-range: 0 250px`, from the top left corner. Shrink with `scale`, not with `font-size` or `height`, so nothing below it jumps.
- Give the sticky name the page background, and the page `scroll-padding-top` as tall as the small title, so it never covers what the keyboard focuses.
- Reduced motion: the name stays at its size and scrolls away with the page.

## Navigation marks the current section

Like brittanychiang.com. Guide: `guides/ui-components/scrollspy.md`

- A small navigation at the top links to each section, and marks the one in view: `scroll-target-group: auto` and `:target-current`, with the guide's fallback for browsers without them. Mark it with more than colour, such as an underline, and keep `aria-current` in step, as the guide says.
- Build the links with a small script from the section headings on the page, so they are always in the site's language. Without JavaScript the page has no navigation, and nothing else is missing.
- Fix the navigation to the top with `position: fixed`, and keep its height free at the top of the page in the stylesheet, so nothing jumps when the script adds it.
- The sections stay one below the other: never put the navigation or the bio in a column beside them.
- Reduced motion: the mark moves without animation.

## Staggered entrance on load

Like paco.me and antfu.me. Guide: `guides/ui-behaviors/dynamic-sibling-animations.md`

- When the page opens, the parts of the bio, or the projects, settle into place one after the other: a short animation with `animation-delay: calc(sibling-index() * 60ms)`, and the guide's fallback.
- Move them a short way with `translate`, all done within half a second. Never start them see-through.
- Reduced motion: nothing moves.

## Other cards step back on hover and focus

Like brittanychiang.com. Guide: `guides/css/child-state-based-styling.md`

- While the pointer is on one project, or the keyboard is in it, the other projects step back: `.projects:has(.project:hover, .project:focus-within) .project:not(:hover, :focus-within)`, scaled down a little and with a fainter border.
- Their text stays readable: never lower its contrast below the brief's.
- Reduced motion: the change happens at once.

## Stickers with a spring

Like cydstumpel.nl and joshwcomeau.com. Guide: `guides/ui-behaviors/physics-based-easing.md`

- Skill stickers, and badges, wobble and grow a little on hover, and on keyboard focus where they are links, with a spring easing made with `linear()`, on `scale` and `rotate`.
- Skip the guide's library fallback: it loads a file from another server. A plain `ease-out` is the fallback.
- Reduced motion: no spring; the sticker changes at once, or not at all.

## Photo in an arch or circle

Like una.im and delba.dev. Guide: `guides/visual-design/complex-shapes.md`

- The photo is shown in a shape: a circle (`border-radius: 50%`), an arch (`border-radius: 999px 999px 0 0`) or a free shape with `mask-image`, as the guide shows. Needs a `photo` in the content file.
- Nothing moves, so reduced motion changes nothing. The photo keeps its alt text, its width and height.

## Event badges pop in

For the event badges. Guide: `guides/ui-behaviors/animate-element-entry-exit.md`

- The event and session badges pop in when the page shows them: a transition from `scale: 0.6` with `@starting-style`. Needs `events` in the content file; the badges' markup is described in `widgets.md`, next to this skill.
- Scale only, never from see-through.
- Reduced motion: no pop; the badges are simply there.

## Typographic polish

Like shud.in. Guide: `guides/visual-design/improve-text-layout-and-legibility.md`

- Headings break into even lines with `text-wrap: balance`, paragraphs avoid a lonely last word with `text-wrap: pretty`. Add what suits the style: old-style numbers for a serif (`font-variant-numeric: oldstyle-nums`), slightly tighter letter spacing on big headings, `hyphens: auto` in a narrow column.
- Nothing moves, so reduced motion changes nothing.
