# The Developer's checkpoint

The end of the Developer's block: the Developer's `site/index.html` and `site/assets/styles.css`, built from the default design brief, in the Classic style. When you jump here, the stylesheet takes the six colours and the fonts of your own brief, if the brief is finished. The rest stays the default design.

The fonts come from the folder `fonts/`, as `node tools/fonts.mjs` gives them to the Developer: the checkpoint copies the bundled fonts the stylesheet's font stacks start with into `site/assets/fonts/`, each with its licence, and puts their `@font-face` rules on top of the stylesheet.

The Developer ends its step with `node tools/legal.mjs`, so this checkpoint also writes the legal page, `site/privacy.html`, the same way: the template in `tools/legal/privacy-template.html` with its legal notice, privacy notice and accessibility statement, its blanks filled in from your content file. That is your name, the email address in your links, today's date, and the address, phone number and VAT number if your content file has them, plus a section about your photo if your site shows one. The page is in English. A legal page already written for you, which names you and has no blanks, stays as it is: the one your Developer translated, for example. This folder holds no copy of the template: the page comes from the same file the command uses.
