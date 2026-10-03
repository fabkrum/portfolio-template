// Opens pages of the site in the participant's own Chrome (headless) and
// reports what a visitor's browser would show: console errors and
// accessibility problems found by axe-core, the engine behind Lighthouse's
// accessibility audits. Uses only Node built-ins: no npm packages.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { delimiter, extname, join, normalize, resolve, sep } from "node:path";

const AXE_PATH = new URL("../vendor/axe-core/axe.min.js", import.meta.url);

// The WCAG 2.x A and AA rules, which carry Lighthouse's accessibility score.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const PAGE_TIMEOUT_MS = 15_000;

// Waits for the promise, but at most ms; never keeps Node alive afterwards.
function waitAtMost(promise, ms) {
  let timer;
  const timeout = new Promise((done) => (timer = setTimeout(done, ms)));
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export function findChrome() {
  const candidates = [process.env.CHROME_PATH];
  if (process.platform === "darwin") {
    for (const app of ["Google Chrome", "Chromium"]) {
      candidates.push(`/Applications/${app}.app/Contents/MacOS/${app}`);
      candidates.push(join(process.env.HOME ?? "", `Applications/${app}.app/Contents/MacOS/${app}`));
    }
  } else if (process.platform === "win32") {
    for (const root of [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ]) {
      if (root) candidates.push(join(root, "Google", "Chrome", "Application", "chrome.exe"));
    }
  } else {
    const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
    for (const dir of (process.env.PATH ?? "").split(delimiter)) {
      for (const name of names) candidates.push(join(dir, name));
    }
  }
  return candidates.find((path) => path && existsSync(path));
}

// Serves the site folder on a free local port, like the participant's preview.
function serveSite(siteDir) {
  const root = resolve(siteDir);
  const server = createServer(async (request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let filePath = normalize(join(root, urlPath));
    if (urlPath.endsWith("/")) filePath = join(filePath, "index.html");
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      const type = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
      response.writeHead(200, { "content-type": type }).end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    }
  });
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      done({
        origin: `http://127.0.0.1:${server.address().port}`,
        close() {
          server.close();
          server.closeAllConnections();
        },
      });
    });
  });
}

async function launchChrome(chromePath) {
  const profileDir = await mkdtemp(join(tmpdir(), "portfolio-check-"));
  const args = [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ];
  // CI containers often cannot use Chrome's sandbox; on a laptop it stays on.
  if (process.platform === "linux" && process.env.CI) args.unshift("--no-sandbox");
  const chrome = spawn(chromePath, args, { stdio: ["ignore", "ignore", "pipe"] });

  const endpoint = await new Promise((done, fail) => {
    let output = "";
    const timer = setTimeout(() => fail(new Error("Chrome did not start in time")), PAGE_TIMEOUT_MS);
    chrome.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
    chrome.on("error", (error) => {
      clearTimeout(timer);
      fail(error);
    });
    chrome.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`Chrome exited early (code ${code})`));
    });
  });

  return {
    endpoint,
    async close() {
      const exited = new Promise((done) => chrome.once("exit", done));
      chrome.kill();
      await waitAtMost(exited, 3000);
      // Windows may hold the profile for a moment after exit.
      await rm(profileDir, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
    },
  };
}

// A minimal Chrome DevTools Protocol client over Node's built-in WebSocket.
async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", () => fail(new Error("Could not connect to Chrome")), { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { done, fail } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) fail(new Error(message.error.message));
      else done(message.result);
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  });
  return {
    send(method, params = {}, sessionId) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params, sessionId }));
      return new Promise((done, fail) => pending.set(id, { done, fail }));
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => socket.close(),
  };
}

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
    await waitAtMost(idle, PAGE_TIMEOUT_MS);

    await cdp.send("Runtime.evaluate", { expression: axeSource }, sessionId);
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `axe.run(document, {
          runOnly: { type: "tag", values: ${JSON.stringify(AXE_TAGS)} },
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
  let cdp;
  try {
    chrome = await launchChrome(chromePath);
    cdp = await connect(chrome.endpoint);
    const pages = [];
    for (const pagePath of pagePaths) {
      const page = await inspectPage(cdp, `${server.origin}/${pagePath}`, axeSource);
      pages.push({ ...page, path: pagePath });
    }
    return pages;
  } finally {
    cdp?.close();
    await chrome?.close();
    server.close();
  }
}
