# The markup of the first screen and the widgets

`site/assets/render.js` turns `site/content.json` into this markup. Style what is here; every value comes from the content file. Each part is left out when its field is missing from the content file, so a site without a photo or without availability looks finished too: never style a gap for something that is not there.

The words the page adds itself, such as "Based in", come from `labels` in the content file when the site is not in English. Never type them into `index.html`, `render.js` or the CSS.

## The first screen: `<header id="bio">`

```html
<header id="bio" class="section">
  <img class="photo" src="assets/photo.webp" alt="Smiling in front of a bookshelf" width="160" height="160" fetchpriority="high" decoding="async">
  <h1>Ada Example</h1>
  <p class="headline">Frontend developer who likes fast, accessible web pages</p>
  <p class="pitch">I build small, fast websites that everyone can use.</p>
  <ul class="highlights">
    <li>Every page I look after scores 100 for accessibility</li>
    <li><a href="https://github.com/octocat">Two open-source projects on GitHub</a></li>
  </ul>
  <p class="availability">Open to junior frontend roles from January 2027. <a href="mailto:ada@example.com">Write to me</a></p>
  <ul class="facts">
    <li class="location"><span class="fact-label">Based in</span> Milan, Italy (Central European Time)</li>
    <li class="languages"><span class="fact-label">Speaks</span> English (native) and Italian (B2)</li>
  </ul>
  <p>One paragraph of the bio.</p>
  <p>Another paragraph of the bio.</p>
</header>
```

- `img.photo`: the person's photo, first in the header. **Round by default**: `.photo { border-radius: 50%; }`. A style may give it another shape, such as an arch or a square. Set its size in the CSS with `width` and `height: auto`, and keep the `width` and `height` in the markup: they keep the page from jumping while the photo loads. It loads early on purpose: never add `loading="lazy"`. To put the photo beside the text on wide screens, make `#bio` a grid with the photo in a column of its own that spans every row.
- `p.pitch`: one sentence, what the person offers. It is the most important sentence on the page: give it more weight than the bio.
- `ul.highlights`: up to three things a visitor gets; an item may be a link to its proof.
- `p.availability`: in words, with the action as the only link. The action is the first screen's main button if the brief has buttons.
- `ul.facts`: small facts in one line or a few chips, each with `span.fact-label` in front. `li.location` holds the city and the time zone, `li.languages` the languages with their levels.

## The colophon line: `<div id="colophon">` in the footer

```html
<footer>
  <a href="privacy.html">Privacy</a>
  <div id="colophon">Built with AI agents at <a href="https://…">DevFest Milano</a>, <time datetime="2026-10-10">October 10, 2026</time>. No trackers. Fonts served from this site.</div>
</footer>
```

Keep the empty `<div id="colophon"></div>` in the footer of `index.html`: the line is filled in there. Without it, the line lands at the end of `<main>`. Style it as `#colophon`: the footer's small print. The event is a link only when the content file gives its address.

## Where each part goes

Every part fills the element of `index.html` with its id, wherever that element is. A part with no element of its own goes at the end of `<main>`. To move one, put its empty element where it belongs, for example `<section id="events" class="section"></section>`.
