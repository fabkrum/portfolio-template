// Says whether a colour is readable as text on a background. The Designer
// role runs it for the person's colour on the page background:
//
//   node tools/contrast.mjs FF6A2B FFF8EC
//
// Write the hex values without the #, or in quotes: in a terminal, a # starts
// a comment. Text needs a contrast of at least 4.5:1 (WCAG 2.2 AA). A colour
// below that can still fill the space behind dark text. Like the Check, it
// only reports.
import { contrast, MINIMUM_CONTRAST, shownContrast } from "./brief/check-brief.mjs";

const hex = (value) => (/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value ?? "") ? `#${value.replace(/^#/, "").toUpperCase()}` : null);
const [colour, background] = process.argv.slice(2, 4).map(hex);

if (!colour || !background) {
  console.log("Give two colours as hex values, the colour first and the background second, without the #:\n");
  console.log("  node tools/contrast.mjs FF6A2B FFF8EC");
} else {
  const ratio = contrast(colour, background);
  console.log(
    ratio >= MINIMUM_CONTRAST
      ? `${colour} on ${background}: ${shownContrast(ratio)}. Readable as text: it has at least ${MINIMUM_CONTRAST}:1.`
      : `${colour} on ${background}: ${shownContrast(ratio)}. Too light for text on this background, which needs at least ${MINIMUM_CONTRAST}:1. Use it behind dark text instead, as a fill.`,
  );
}
// Always 0: this reports, it never gates.
process.exitCode = 0;
