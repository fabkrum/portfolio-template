// Where the project cards and the sections of a fixture site sit in Chrome.
import assert from "node:assert/strict";
import { findChrome, launchChrome, openTab } from "../tools/check/chrome.mjs";
import { serveSite } from "../tools/check/serve-site.mjs";
import { buildFixtureSite } from "./fixture-site.js";

// Where the project cards and the sections sit on the page in Chrome at the given window width.
export async function pageLayout(siteDir, width) {
  const server = await serveSite(siteDir);
  let chrome;
  try {
    chrome = await launchChrome(findChrome());
    const { cdp } = chrome;
    const { sessionId } = await openTab(cdp);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send("Page.navigate", { url: `${server.origin}/` }, sessionId);
    // main.js fills the page from the content file after load; wait until the cards are there and the fonts are in.
    const expression = `(async () => {
      for (let tries = 0; tries < 100 && !document.querySelector(".project"); tries++) await new Promise((done) => setTimeout(done, 50));
      await document.fonts.ready;
      const box = (element) => {
        const { left, top, bottom } = element.getBoundingClientRect();
        return { id: element.id, left: Math.round(left), top: Math.round(top), bottom: Math.round(bottom) };
      };
      return {
        cards: [...document.querySelectorAll(".project")].map(box),
        sections: [...document.querySelectorAll(".section:not([hidden])")].map(box),
      };
    })()`;
    const { result } = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    return result.value;
  } finally {
    await chrome?.close();
    server.close();
  }
}

// Every brief so far asks for the project cards side by side in two columns
// from 40rem, and for 3rem or more between sections; 2rem (32px) is the floor here.
export async function assertWideLayout(fixturesDir, name) {
  const { siteDir, remove } = await buildFixtureSite(fixturesDir, name);
  try {
    const { cards, sections } = await pageLayout(siteDir, 1280);
    const [first, second] = cards;
    assert.ok(first && second, "fewer than two project cards on the page");
    assert.equal(second.top, first.top, `cards at ${JSON.stringify(cards)}`);
    assert.ok(second.left > first.left, `cards at ${JSON.stringify(cards)}`);
    assert.equal(sections.length, 4, JSON.stringify(sections));
    for (const [above, below] of sections.slice(1).map((section, index) => [sections[index], section])) {
      assert.ok(below.top - above.bottom >= 32, `${below.top - above.bottom}px between #${above.id} and #${below.id}`);
    }
  } finally {
    await remove();
  }
}
