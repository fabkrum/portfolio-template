// What a site folder shows in Chrome: builds it, serves the built site,
// opens its home page (or the page given) once the network is quiet, and
// evaluates an expression there, waiting for it if it gives a promise.
import { serveBuild } from "../tools/build/serve-build.mjs";
import { findChrome, launchChrome, navigate, openTab } from "../tools/check/chrome.mjs";

export async function inChrome(siteDir, expression, page = "") {
  const site = await serveBuild(siteDir);
  let chrome;
  try {
    chrome = await launchChrome(findChrome());
    const { sessionId } = await openTab(chrome.cdp);
    await navigate(chrome.cdp, sessionId, `${site.origin}/${page}`);
    const { result } = await chrome.cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    return result.value;
  } finally {
    await chrome?.close();
    await site.close();
  }
}
