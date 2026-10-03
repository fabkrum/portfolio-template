// The preview. Run it from your repo folder:
//
//   node tools/preview.mjs
//
// It shows your site at a local address in your own browser, the way it will
// look once published. It keeps running until you press Ctrl+C.
import { fileURLToPath } from "node:url";
import { serveSite } from "./check/serve-site.mjs";

const siteDir = fileURLToPath(new URL("../site", import.meta.url));
const PORT = 8000;

let server;
try {
  server = await serveSite(siteDir, PORT);
} catch (error) {
  if (error.code !== "EADDRINUSE") throw error;
  // Something else already uses port 8000: take any free port instead.
  server = await serveSite(siteDir);
}
console.log(`Your site is running at http://localhost:${server.port}`);
console.log("Open that address in Chrome. After a change, reload the page.");
console.log("To stop the preview, press Ctrl+C in this window.");
