// Looks at the site the way visitors see it: a screenshot of every page at
// phone and wide width, in light and dark mode, plus how fast the home page
// shows up on a phone and whether it jumps while it loads. Uses the
// participant's own Chrome (headless) and only Node built-ins.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { launchChrome, navigate, openTab } from "../check/chrome.mjs";
import { serveSite } from "../check/serve-site.mjs";

export const WIDTHS = { phone: 390, wide: 1280 };
const SCHEMES = ["light", "dark"];
const SCREEN_HEIGHT = 900;
// Taller pages are cut off here, so a runaway layout cannot fill the disk.
const MAX_SCREENSHOT_HEIGHT = 8000;

// A mid-range phone on a slow 4G connection, as Lighthouse's mobile test
// assumes: 150 ms round trips, 1.6 Mbit/s, a processor 4 times slower.
const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const PHONE_CPU_SLOWDOWN = 4;

// Good values according to web.dev/articles/vitals.
export const GOOD = { lcp: 2500, cls: 0.1 };

async function setScreen(cdp, sessionId, width, scheme) {
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width, height: SCREEN_HEIGHT, deviceScaleFactor: 1, mobile: width === WIDTHS.phone },
    sessionId,
  );
  await cdp.send(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-color-scheme", value: scheme }] },
    sessionId,
  );
}

const evaluate = async (cdp, sessionId, expression) =>
  (await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId)).result
    .value;

// Fonts in, and a moment for anything the scripts still draw.
const SETTLED = `document.fonts.ready.then(() => new Promise((done) => setTimeout(done, 300)))`;

async function screenshot(cdp, sessionId, width) {
  const height = await evaluate(cdp, sessionId, "document.documentElement.scrollHeight");
  const { data } = await cdp.send(
    "Page.captureScreenshot",
    {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.min(height, MAX_SCREENSHOT_HEIGHT), scale: 1 },
    },
    sessionId,
  );
  return Buffer.from(data, "base64");
}

// LCP and CLS of one load of the page, measured by the browser itself.
async function measure(cdp, url) {
  const { sessionId, close } = await openTab(cdp);
  try {
    await setScreen(cdp, sessionId, WIDTHS.phone, "light");
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Network.emulateNetworkConditions", SLOW_4G, sessionId);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: PHONE_CPU_SLOWDOWN }, sessionId);
    await navigate(cdp, sessionId, url);
    return await evaluate(
      cdp,
      sessionId,
      `${SETTLED}.then(() => {
        // Buffered observers hand over everything since the page started; their
        // callbacks run a moment later, so read the totals after a pause.
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => (lcp = list.getEntries().at(-1).startTime))
          .observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const shift of list.getEntries()) if (!shift.hadRecentInput) cls += shift.value;
        }).observe({ type: "layout-shift", buffered: true });
        return new Promise((done) => setTimeout(done, 200))
          .then(() => ({ lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000 }));
      })`,
    );
  } finally {
    await close();
  }
}

// Content narrower than this share of its section leaves the rest empty,
// as when a list sits in one column of a grid meant for its cards.
const NARROW_SHARE = 0.7;
// Sections closer together than this run into each other.
const MIN_SECTION_GAP = 32;

// The layout mistakes small models make and the Check cannot see, found in the
// page itself: a section heading beside its content instead of above it,
// content that fills only part of its section, and sections with (almost) no
// space between them.
const LAYOUT_PROBE = `(() => {
  const name = (section) => (section.querySelector("h1, h2")?.textContent ?? section.id).trim();
  const sections = [...document.querySelectorAll(".section")].filter((section) => section.getClientRects().length > 0);
  const found = [];
  for (const section of sections) {
    const heading = section.firstElementChild;
    if (!heading || !/^H[12]$/.test(heading.tagName)) continue;
    const box = heading.getBoundingClientRect();
    const beside = [...section.children].slice(1).some((child) => {
      const other = child.getBoundingClientRect();
      return other.height > 0 && other.top < box.bottom - 1 && (other.left >= box.right - 1 || other.right <= box.left + 1);
    });
    if (beside) {
      found.push({ kind: "beside", heading: name(section) });
      continue;
    }
    const style = getComputedStyle(section);
    const room = section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const narrowest = Math.min(...[...section.children].slice(1).map((child) => child.getBoundingClientRect().width));
    if (narrowest < room * ${NARROW_SHARE}) {
      found.push({ kind: "narrow", heading: name(section), share: Math.round((narrowest / room) * 100) });
    }
  }
  for (const [index, section] of sections.slice(1).entries()) {
    const gap = Math.round(section.getBoundingClientRect().top - sections[index].getBoundingClientRect().bottom);
    if (gap < ${MIN_SECTION_GAP}) found.push({ kind: "gap", heading: name(section), above: name(sections[index]), gap });
  }
  return found;
})()`;

function describeLayout(page, size, width, { kind, heading, above, gap, share }) {
  const where = `${page} at ${size} width (${width}px)`;
  if (kind === "beside") return `${where}: the heading "${heading}" sits beside its section's content instead of above it.`;
  if (kind === "narrow") {
    return `${where}: the content of the section "${heading}" fills only ${share}% of the section's width; the rest stays empty.`;
  }
  return `${where}: the section "${heading}" starts only ${gap}px below "${above}", so the sections run into each other.`;
}

// Saves the screenshots of one page and returns its layout problems.
async function lookAtPage(cdp, url, page, outDir) {
  const screenshots = [];
  const layout = [];
  for (const [size, width] of Object.entries(WIDTHS)) {
    for (const scheme of SCHEMES) {
      const { sessionId, close } = await openTab(cdp);
      try {
        await setScreen(cdp, sessionId, width, scheme);
        await navigate(cdp, sessionId, url);
        await evaluate(cdp, sessionId, SETTLED);
        const file = join(outDir, `${page.replace(/\.html$/, "")}-${size}-${scheme}.png`);
        await writeFile(file, await screenshot(cdp, sessionId, width));
        screenshots.push(file);
        if (scheme === "light") {
          const pageWidth = await evaluate(cdp, sessionId, "document.documentElement.scrollWidth");
          if (pageWidth > width) {
            layout.push(
              `${page} at ${size} width (${width}px): the page is wider than the screen (${pageWidth}px), so visitors have to scroll sideways.`,
            );
          }
          for (const problem of await evaluate(cdp, sessionId, LAYOUT_PROBE)) {
            layout.push(describeLayout(page, size, width, problem));
          }
        }
      } finally {
        await close();
      }
    }
  }
  return { screenshots, layout };
}

// Looks at every page of the site; saves the screenshots into outDir.
export async function lookAtSite(siteDir, outDir, chromePath) {
  const pages = ["index.html", "privacy.html"].filter((page) => existsSync(join(siteDir, page)));
  await mkdir(outDir, { recursive: true });
  const server = await serveSite(siteDir);
  let chrome;
  try {
    chrome = await launchChrome(chromePath);
    const result = { screenshots: [], layout: [] };
    for (const page of pages) {
      const { screenshots, layout } = await lookAtPage(chrome.cdp, `${server.origin}/${page}`, page, outDir);
      result.screenshots.push(...screenshots);
      result.layout.push(...layout);
    }
    result.performance = await measure(chrome.cdp, `${server.origin}/`);
    return result;
  } finally {
    await chrome?.close();
    server.close();
  }
}
