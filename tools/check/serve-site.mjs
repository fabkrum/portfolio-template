// Serves a folder on a local port: the built site for the Check, look and
// the participant's preview (tools/preview.mjs). Port 0 picks a free one.
// beforePage, if given, runs before every page is served, as the preview
// builds the site again there; when it returns HTML, that is served instead.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

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
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
};

export function serveSite(siteDir, port = 0, { beforePage } = {}) {
  const root = resolve(siteDir);
  const server = createServer(async (request, response) => {
    try {
      const urlPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (beforePage && /(\/|\.html)$/.test(urlPath)) {
        const instead = await beforePage();
        if (instead) {
          response.writeHead(500, { "content-type": CONTENT_TYPES[".html"], "cache-control": "no-cache" }).end(instead);
          return;
        }
      }
      let filePath = normalize(join(root, urlPath));
      if (urlPath.endsWith("/")) filePath = join(filePath, "index.html");
      if (filePath !== root && !filePath.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(filePath);
      const type = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
      // Always the newest version, also of a stylesheet that changed.
      response.writeHead(200, { "content-type": type, "cache-control": "no-cache" }).end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    }
  });
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => {
      done({
        origin: `http://127.0.0.1:${server.address().port}`,
        port: server.address().port,
        close() {
          server.close();
          server.closeAllConnections();
        },
      });
    });
  });
}
