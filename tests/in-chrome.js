// What a site folder shows in Chrome: serves it, opens its home page (or the
// page given) once the content file has been fetched and drawn, and
// evaluates an expression there.
import { findChrome, launchChrome, navigate, openTab } from "../tools/check/chrome.mjs";
import { serveSite } from "../tools/check/serve-site.mjs";

export async function inChrome(siteDir, expression, page = "") {
  const server = await serveSite(siteDir);
  let chrome;
  try {
    chrome = await launchChrome(findChrome());
    const { sessionId } = await openTab(chrome.cdp);
    await navigate(chrome.cdp, sessionId, `${server.origin}/${page}`);
    const { result } = await chrome.cdp.send("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
    return result.value;
  } finally {
    await chrome?.close();
    server.close();
  }
}
