// Opens pages of the site in the participant's own Chrome (headless) and
// reports what a visitor's browser would show: console errors and
// accessibility problems found by axe-core, the engine behind Lighthouse's
// accessibility audits. Uses only Node built-ins: no npm packages.
import { readFile } from "node:fs/promises";
import { launchChrome, TIMEOUT_MS, waitAtMost } from "./chrome.mjs";
import { serveSite } from "./serve-site.mjs";

export { findChrome } from "./chrome.mjs";

const AXE_PATH = new URL("../vendor/axe-core/axe.min.js", import.meta.url);

// The axe rules behind Lighthouse 13.5's weighted accessibility audits
// (core/config/default-config.js). All of them passing = a score of 100.
const LIGHTHOUSE_AXE_RULES = [
  "accesskeys", "aria-allowed-attr", "aria-command-name", "aria-conditional-attr",
  "aria-deprecated-role", "aria-dialog-name", "aria-hidden-body", "aria-hidden-focus",
  "aria-input-field-name", "aria-meter-name", "aria-progressbar-name", "aria-prohibited-attr",
  "aria-required-attr", "aria-required-children", "aria-required-parent", "aria-roles",
  "aria-text", "aria-toggle-field-name", "aria-tooltip-name", "aria-treeitem-name",
  "aria-valid-attr-value", "aria-valid-attr", "autocomplete-valid", "button-name", "bypass",
  "color-contrast", "definition-list", "dlitem", "document-title", "duplicate-id-aria",
  "form-field-multiple-labels", "frame-title", "heading-order", "html-has-lang",
  "html-lang-valid", "html-xml-lang-mismatch", "image-alt", "input-button-name",
  "input-image-alt", "label", "landmark-one-main", "link-in-text-block", "link-name", "list",
  "listitem", "meta-refresh", "meta-viewport", "object-alt", "presentation-role-conflict",
  "select-name", "skip-link", "svg-img-alt", "tabindex", "target-size", "td-headers-attr",
  "th-has-data-cells", "valid-lang", "video-caption",
];

function describeException({ exceptionDetails }) {
  const description = exceptionDetails.exception?.description ?? exceptionDetails.text;
  return description.split("\n")[0];
}

async function inspectPage(cdp, url, axeSource) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const consoleErrors = [];
  let markIdle;
  const idle = new Promise((done) => (markIdle = done));

  const stopListening = cdp.onEvent((event) => {
    if (event.sessionId !== sessionId) return;
    const { method, params } = event;
    if (method === "Runtime.consoleAPICalled" && params.type === "error") {
      consoleErrors.push(params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    } else if (method === "Runtime.exceptionThrown") {
      consoleErrors.push(describeException(params));
    } else if (method === "Log.entryAdded" && params.entry.level === "error") {
      consoleErrors.push(params.entry.url ? `${params.entry.text} (${params.entry.url})` : params.entry.text);
    } else if (method === "Page.lifecycleEvent" && params.name === "networkIdle") {
      markIdle();
    }
  });

  try {
    for (const domain of ["Runtime", "Log", "Page"]) await cdp.send(`${domain}.enable`, {}, sessionId);
    await cdp.send("Page.setLifecycleEventsEnabled", { enabled: true }, sessionId);
    await cdp.send("Page.navigate", { url }, sessionId);
    await waitAtMost(idle, TIMEOUT_MS);

    await cdp.send("Runtime.evaluate", { expression: axeSource }, sessionId);
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `axe.run(document, {
          runOnly: { type: "rule", values: ${JSON.stringify(LIGHTHOUSE_AXE_RULES)} },
          resultTypes: ["violations"],
        }).then((results) => results.violations.map((violation) => ({
          id: violation.id,
          help: violation.help,
          targets: violation.nodes.map((node) => node.target.join(" ")),
        })))`,
        awaitPromise: true,
        returnByValue: true,
      },
      sessionId,
    );
    if (exceptionDetails) throw new Error(`axe failed: ${describeException({ exceptionDetails })}`);
    return { url, consoleErrors, violations: result.value };
  } finally {
    stopListening();
    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

// Opens each page (paths relative to the site folder) and returns, per page,
// its console errors and accessibility violations.
export async function inspectSite(siteDir, pagePaths, chromePath) {
  const axeSource = await readFile(AXE_PATH, "utf8");
  const server = await serveSite(siteDir);
  let chrome;
  try {
    chrome = await launchChrome(chromePath);
    const pages = [];
    for (const pagePath of pagePaths) {
      const page = await inspectPage(chrome.cdp, `${server.origin}/${pagePath}`, axeSource);
      pages.push({ ...page, path: pagePath });
    }
    return pages;
  } finally {
    await chrome?.close();
    server.close();
  }
}
