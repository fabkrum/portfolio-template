// Finds and starts the participant's own Chrome (headless) and talks to it
// over the Chrome DevTools Protocol, using Node's built-in WebSocket.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

// Slow laptops and busy Windows runners sometimes need more than 15 seconds
// for Chrome to answer, especially for the first page it opens.
export const TIMEOUT_MS = 30_000;

// Waits for the promise, but at most ms; never keeps Node alive afterwards.
export function waitAtMost(promise, ms) {
  let timer;
  const timeout = new Promise((done) => (timer = setTimeout(done, ms)));
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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

// A minimal DevTools Protocol client; every call gives up after TIMEOUT_MS.
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
      let timer;
      return new Promise((done, fail) => {
        pending.set(id, { done, fail });
        timer = setTimeout(() => {
          pending.delete(id);
          fail(new Error(`Chrome did not answer in time (${method})`));
        }, TIMEOUT_MS);
      }).finally(() => clearTimeout(timer));
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => socket.close(),
  };
}

// Starts headless Chrome with a throwaway profile; returns a connected client.
export async function launchChrome(chromePath) {
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
  const exited = new Promise((done) => chrome.once("exit", done));

  async function close(cdp) {
    // Asking Chrome to close lets it end its helper processes and release the
    // profile folder (Windows keeps it locked otherwise); kill is the fallback.
    await cdp?.send("Browser.close").catch(() => {});
    cdp?.close();
    if ((await waitAtMost(exited.then(() => true), 3000)) !== true) chrome.kill();
    await waitAtMost(exited, 3000);
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
  }

  try {
    const endpoint = await new Promise((done, fail) => {
      let output = "";
      const timer = setTimeout(() => fail(new Error("Chrome did not start in time")), TIMEOUT_MS);
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
    const cdp = await connect(endpoint);
    return { cdp, close: () => close(cdp) };
  } catch (error) {
    await close();
    throw error;
  }
}

// Opens a new tab on a blank page and returns its session id.
export async function openTab(cdp) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  return { sessionId, close: () => cdp.send("Target.closeTarget", { targetId }).catch(() => {}) };
}

// Loads the url in the tab and waits until the network has been quiet, so
// scripts that fetch the content file have run; at most TIMEOUT_MS.
export async function navigate(cdp, sessionId, url) {
  // Chrome replays lifecycle events for the blank start page, so only the
  // "network idle" of our own navigation (its loaderId) counts.
  const idleLoaders = new Set();
  let onIdle = () => {};
  const stopListening = cdp.onEvent(({ sessionId: from, method, params }) => {
    if (from === sessionId && method === "Page.lifecycleEvent" && params.name === "networkIdle") {
      idleLoaders.add(params.loaderId);
      onIdle();
    }
  });
  try {
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Page.setLifecycleEventsEnabled", { enabled: true }, sessionId);
    const { loaderId } = await cdp.send("Page.navigate", { url }, sessionId);
    const idle = new Promise((done) => {
      onIdle = () => idleLoaders.has(loaderId) && done();
      onIdle();
    });
    await waitAtMost(idle, TIMEOUT_MS);
  } finally {
    stopListening();
  }
}
