# Fonts

Two openly licensed fonts for each of the five styles, so the Stitch design and the site use the same fonts, nobody downloads a font in the workshop, and the site loads nothing from other servers. They live here, outside `site/`, so a site publishes only the fonts copied into it: those its design brief names.

| Font | Folder | Style | Used for | In a brief's Type table |
|---|---|---|---|---|
| Newsreader | `newsreader/` | Classic | headings | `"Newsreader", Georgia, "Times New Roman", serif` |
| Literata | `literata/` | Classic | text | `"Literata", Georgia, "Times New Roman", serif` |
| Geist | `geist/` | Modern | headings and text | `"Geist", system-ui, sans-serif` |
| JetBrains Mono | `jetbrains-mono/` | Modern, Technical | dates (Modern); headings, labels and dates (Technical) | `"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace` |
| Anton | `anton/` | Bold | headings | `"Anton", Impact, "Arial Narrow", sans-serif` |
| Work Sans | `work-sans/` | Bold | text | `"Work Sans", system-ui, sans-serif` |
| Bricolage Grotesque | `bricolage-grotesque/` | Playful | headings | `"Bricolage Grotesque", system-ui, sans-serif` |
| Rubik | `rubik/` | Playful | text | `"Rubik", system-ui, sans-serif` |
| IBM Plex Sans | `ibm-plex-sans/` | Technical | text | `"IBM Plex Sans", system-ui, sans-serif` |

## Use them

The Designer names them in the Stitch prompt and in the design brief. The Developer runs one command, the same on every operating system:

```
node tools/fonts.mjs
```

It copies the fonts the design brief names from here into `site/assets/fonts/`, each with its licence, and prints the `@font-face` rules to put at the top of `site/assets/styles.css`.

## What is in each folder

- The font files: WOFF2, Latin letters only (enough for English, Italian, German, French and Spanish), one variable file for every weight where the font has one. Newsreader and Literata also have an italic file.
- `OFL.txt`: the licence, the SIL Open Font License 1.1. It allows using, sharing and bundling the fonts, also on a commercial site, as long as the licence travels with them.
- `font-face.css`: the `@font-face` rules for the files, with paths as they are from `site/assets/styles.css`.
- `README.md`: where the files come from, and their version.

All files come from Fontsource 5.3.0 on npm, which builds them from Google Fonts; the licences from the Google Fonts repository, Geist's from Vercel's. Downloaded on 2026-10-07. Together they are about 480 KB.
