import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { waitAtMost } from "../tools/check/chrome.mjs";

// Git on Windows may check files out with CRLF line endings.
const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll("\r\n", "\n");

// Antigravity reads the MCP servers of a workspace from .agents/mcp_config.json.
const mcpConfig = async () => JSON.parse(await read("../.agents/mcp_config.json"));
const devtoolsServer = async () => (await mcpConfig()).mcpServers["chrome-devtools"];

// The package and version the server runs, such as "chrome-devtools-mcp@1.10.1".
const pinnedPackage = (args) => args.find((arg) => arg.startsWith("chrome-devtools-mcp@"));

test("Antigravity starts one pinned version of Chrome DevTools for agents, with a throwaway Chrome profile and no usage statistics", async () => {
  assert.deepEqual(Object.keys((await mcpConfig()).mcpServers), ["chrome-devtools"]);
  const { command, args } = await devtoolsServer();
  assert.equal(command, "npx");
  // -y first: npx installs without stopping to ask, and only then comes the package.
  assert.equal(args[0], "-y");
  assert.equal(args[1], pinnedPackage(args));
  assert.match(pinnedPackage(args), /^chrome-devtools-mcp@\d+\.\d+\.\d+$/, "an exact version, never a range or @latest");
  for (const flag of ["--isolated", "--no-usage-statistics"]) assert.ok(args.includes(flag), flag);
});

// The Install script downloads the server ahead of time, so nothing is
// downloaded in the QA block. That only works for the very same version.
test("the Install scripts download exactly the version Antigravity starts", async () => {
  const pinned = pinnedPackage((await devtoolsServer()).args);
  for (const script of ["../install.sh", "../install.ps1"]) {
    const named = (await read(script)).match(/chrome-devtools-mcp@[^\s"'`]*/g) ?? [];
    assert.ok(named.length > 0, `${script} downloads no Chrome DevTools for agents`);
    for (const spec of named) assert.equal(spec, pinned, script);
  }
});

// Starts a program and speaks MCP with it over its standard input and output:
// one JSON-RPC message per line. The first answer waits for npx to download and
// start the server, as on a participant's laptop: this is the one test that
// needs the npm registry. On the Windows runner, next to the other tests, that
// took between 50 and 110 seconds. Every later answer comes from the running
// server.
const START_MS = 300_000;
const ANSWER_MS = 30_000;
const HANDSHAKE_MS = START_MS + 2 * ANSWER_MS + 15_000;

function startServer(command, args, options = {}) {
  // On macOS and Linux the server gets a process group of its own, so that
  // stop() can end npx and the server it started together.
  const child = spawn(command, args, { ...options, detached: process.platform !== "win32" });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let received = "";
  let stderr = "";
  const waiting = new Map();
  child.stderr.on("data", (chunk) => (stderr += chunk));
  child.stdout.on("data", (chunk) => {
    received += chunk;
    let end;
    while ((end = received.indexOf("\n")) >= 0) {
      const line = received.slice(0, end).trim();
      received = received.slice(end + 1);
      if (!line.startsWith("{")) continue;
      const message = JSON.parse(line);
      waiting.get(message.id)?.(message);
    }
  });
  const exited = new Promise((done) => child.once("exit", () => done(true)));
  // Rejects as soon as the program cannot start or ends: every answer has to
  // come before that.
  const ended = new Promise((_, fail) => {
    child.once("error", fail);
    exited.then(() => fail(new Error(`it stopped before it answered. Its error output:\n${stderr}`)));
  });
  ended.catch(() => {});
  let nextId = 1;
  const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  return {
    async request(method, params = {}, withinMs = ANSWER_MS) {
      const id = nextId++;
      const answer = new Promise((done) => waiting.set(id, done));
      send({ id, method, params });
      const message = await waitAtMost(Promise.race([answer, ended]), withinMs);
      assert.ok(message, `no answer to ${method} within ${withinMs / 1000} s. Its error output:\n${stderr}`);
      assert.equal(message.error, undefined, `${method}: ${JSON.stringify(message.error)}`);
      return message.result;
    },
    notify: (method, params = {}) => send({ method, params }),
    // A stdio MCP server stops when its input ends. Whatever still runs after
    // ten seconds is stopped, with everything it started.
    async stop() {
      child.stdin.end();
      if ((await waitAtMost(exited, 10_000)) !== true) {
        if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
        else process.kill(-child.pid, "SIGKILL");
      }
      child.stdout.destroy();
      child.stderr.destroy();
    },
  };
}

// The handshake an MCP host such as Antigravity makes before it offers the
// tools to the agent: initialize, initialized, then the list of tools, page by page.
async function handshake(server) {
  const init = await server.request(
    "initialize",
    { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "portfolio-template-tests", version: "1.0.0" } },
    START_MS,
  );
  server.notify("notifications/initialized");
  const tools = [];
  let cursor;
  do {
    const page = await server.request("tools/list", cursor ? { cursor } : {});
    tools.push(...page.tools.map((tool) => tool.name));
    cursor = page.nextCursor;
  } while (cursor);
  return { serverInfo: init.serverInfo, tools };
}

// What the QA skill uses: screenshots, a performance trace for LCP and CLS, and Lighthouse.
const QA_TOOLS = ["take_screenshot", "performance_start_trace", "lighthouse_audit"];

async function assertHandshake(server, pinned) {
  try {
    const { serverInfo, tools } = await handshake(server);
    assert.equal(`chrome-devtools-mcp@${serverInfo.version}`, pinned, "the pinned version runs");
    for (const name of QA_TOOLS) assert.ok(tools.includes(name), `${name} is missing from: ${tools.join(", ")}`);
  } finally {
    await server.stop();
  }
}

// Windows: Node cannot start npx, which is npx.cmd there, without a shell. So
// on Windows the test hands the command line to cmd.exe. That is how hosts
// built on the MCP SDK start a server (cross-spawn), and it is what Windows
// itself does for a host that starts npx.cmd directly, as Go programs do.
// How Antigravity IDE starts it is unknown: a host that starts plain npx with
// neither fails, and then the form in the next test is the fallback.
test("the server starts as the config says and offers screenshots, a performance trace and Lighthouse", { timeout: HANDSHAKE_MS }, async () => {
  const { command, args } = await devtoolsServer();
  const server =
    process.platform === "win32" ? startServer([command, ...args].join(" "), [], { shell: true }) : startServer(command, args);
  await assertHandshake(server, pinnedPackage(args));
});

// The fallback for a Windows host that cannot start npx: "command": "cmd",
// "args": ["/c", "npx", ...], as Codex documents it for Windows. Antigravity
// would need it only if the config as it is fails there; this test keeps that
// way out proven.
test(
  "Windows fallback: the same server also starts as cmd /c npx",
  { skip: process.platform !== "win32" && "Windows only", timeout: HANDSHAKE_MS },
  async () => {
    const { command, args } = await devtoolsServer();
    await assertHandshake(startServer("cmd", ["/c", command, ...args]), pinnedPackage(args));
  },
);
