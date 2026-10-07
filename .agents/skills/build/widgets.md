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

## The widgets

Each widget is a section of its own, shown only when the content file has its field. Style the widgets the person has; give the others nothing. Dates, such as `Oct 10, 2026`, are written in the site's language, each in a `<time>` element.

### Numbers: `<section id="stats">`

```html
<h2>In numbers</h2>
<ul class="stats">
  <li class="stat"><span class="stat-value">2</span> <span class="stat-label">projects shipped</span></li>
</ul>
```

Up to four, one `li.stat` each in `ul.stats`. Make `.stat-value` big and `.stat-label` small, side by side on wide screens.

### Now: `<section id="now">`

```html
<h2>Now</h2>
<p class="period">Updated <time datetime="2026-10">October 2026</time></p>
<ul class="now">
  <li>Learning view transitions</li>
</ul>
```

Up to three things the person is doing now, in `ul.now`, with the month they wrote them in `p.period`.

### Events: `<section id="events">`

```html
<h2>Events</h2>
<h3>Up next</h3>
<ul class="events upcoming">
  <li class="event">
    <h4 class="event-badge"><a href="https://…">Example Conf</a> <span class="role">Speaker</span></h4>
    <p class="period"><time datetime="2026-11-20">Nov 20 – 21, 2026</time> · Turin</p>
    <ul class="sessions">
      <li class="session"><span class="session-badge"><span class="type">Talk</span> <a href="https://…">Accessible Forms</a></span> <a href="https://…">Slides</a> <a href="https://…">Video</a></li>
    </ul>
  </li>
</ul>
<h3>Past events</h3>
<ul class="events past">…</ul>
```

- Each event is a container, `li.event`, with its sessions inside. Two kinds of badge: `h4.event-badge` holds the event's name and the person's role, `span.role` (Attendee, Speaker, Organizer, Volunteer or Mentor); `span.session-badge` holds a session's type, `span.type` (Talk, Workshop, Keynote, Panel or Codelab), and its title. Style both as badges in the shapes of the brief's style: pills or stickers where it has rounded corners, such as Playful; square corners where it has none, such as Classic. Each badge sets its `.role` or `.type` apart. The workshop of the day shows as an event badge, such as DevFest Milano · Attendee, and a session badge, Workshop · AI-Native Web Development, Hands-On.
- `ul.events.upcoming` comes first, the soonest event first: give it the most weight, it says where to meet the person. `ul.events.past` follows, the latest first. Either is left out when it has no event; an event counts as upcoming up to its last day.
- `ul.sessions` holds one `li.session` per session. A session's slides and video are the links after its badge; its title links inside the badge.
- An event online says Online where the city would be.

### Certifications: `<section id="certifications">` and `<section id="courses">`

```html
<h2>Certifications</h2>
<ul class="certifications">
  <li class="certification">
    <h3>Example Certified Frontend Developer</h3>
    <p class="period">Example Academy · <time datetime="2026-03">Mar 2026</time> – <time datetime="2029-03">Mar 2029</time></p>
    <p class="credential-id">Credential ID EX-0000-0000</p>
    <p class="verify"><a href="https://…">Verify</a></p>
  </li>
</ul>
```

Certifications from an exam go into `#certifications`; courses and workshops into `#courses`, under the heading Courses & workshops, with the same markup: one `li.certification` each in `ul.certifications`. Expired ones are left out. `p.credential-id` shows the ID when there is one, and `p.verify` links to the issuer's page that proves it.

### A project as a case study: in `li.project`

```html
<li class="project">
  <h3>Tide Tables</h3>
  <img class="project-image" src="assets/tide-tables.webp" alt="…" loading="lazy" decoding="async">
  <p>One sentence about the project.</p>
  <dl class="case-study">
    <dt>Problem</dt><dd>…</dd>
    <dt>My role</dt><dd>…</dd>
    <dt>Outcome</dt><dd>…</dd>
    <dt>Stack</dt><dd>…</dd>
    <dt>With AI</dt><dd>What the agent did, and what the person did.</dd>
  </dl>
  <p class="project-links">…</p>
</li>
```

A project without these fields is the plain card as before. `img.project-image` has no width and height in the markup, as a screenshot can have any shape: give it `width: 100%`, `height: auto`, an `aspect-ratio` and `object-fit: cover` in the CSS, so it fits the card on a phone and the card does not jump while it loads. `dl.case-study` lists only the fields the project has.

## Where each part goes

Every part fills the element of `index.html` with its id, wherever that element is. `index.html` has an empty element for each: the numbers and Now under the first screen, then the projects, events, certifications, courses, links and CV. A part with no element of its own goes at the end of `<main>`. To move one, move its empty element, for example `<section id="events" class="section"></section>`.
