# The Developer's checkpoint

The end of the Developer's block: the Developer's `site/index.html` and `site/assets/styles.css`, built from the default design brief, in the Classic style. When you jump here, the stylesheet takes the six colours and the fonts of your own brief, if the brief is finished. The rest stays the default design.

The fonts come from the folder `fonts/`, as `node tools/fonts.mjs` gives them to the Developer: the checkpoint copies the bundled fonts the stylesheet's font stacks start with into `site/assets/fonts/`, each with its licence, and puts their `@font-face` rules on top of the stylesheet.
