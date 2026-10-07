// Turns a photo into a small square WebP in the participant's own Chrome
// (headless): a square from the middle of the photo, at most 480 pixels wide.
// Chrome draws the photo upright on a canvas and saves the canvas, which
// holds only pixels: none of the hidden data a phone or camera stores in a
// photo, such as where and when it was taken, reaches the new file. Uses only
// Node built-ins.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { launchChrome, navigate, openTab } from "../check/chrome.mjs";

export const SIZE = 480;
const QUALITY = 0.82;

// The photo's bytes on a local port, next to an empty page of the same
// origin: a canvas only gives back the pixels of a picture from its own origin.
function servePhoto(bytes) {
  const server = createServer((request, response) => {
    if (request.url === "/photo") response.writeHead(200, { "content-type": "application/octet-stream" }).end(bytes);
    else response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<!doctype html><title>Photo</title>");
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

// Runs in the page. Chrome turns a phone photo upright by itself, from the
// orientation the phone saved; the natural width and height are the upright ones.
const SQUARE = `(async () => {
  const image = new Image();
  image.src = "/photo";
  try {
    await image.decode();
  } catch {
    return { unreadable: true };
  }
  const { naturalWidth: width, naturalHeight: height } = image;
  const side = Math.min(width, height);
  const size = Math.min(side, ${SIZE});
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);
  return { width, height, size, webp: canvas.toDataURL("image/webp", ${QUALITY}) };
})()`;

// The square WebP of the photo at photoPath as { width, height, size, webp }:
// the photo's width and height, the square's size and its bytes. Or
// { unreadable: true } when Chrome cannot read the file as a picture.
export async function squarePhoto(photoPath, chromePath) {
  const server = await servePhoto(await readFile(photoPath));
  let chrome;
  try {
    chrome = await launchChrome(chromePath);
    const { sessionId } = await openTab(chrome.cdp);
    await navigate(chrome.cdp, sessionId, `${server.origin}/`);
    const { result, exceptionDetails } = await chrome.cdp.send(
      "Runtime.evaluate",
      { expression: SQUARE, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    if (result.value.unreadable) return { unreadable: true };
    const { width, height, size, webp } = result.value;
    const prefix = "data:image/webp;base64,";
    if (!webp.startsWith(prefix)) throw new Error("Chrome could not save the picture as WebP");
    return { width, height, size, webp: Buffer.from(webp.slice(prefix.length), "base64") };
  } finally {
    await chrome?.close();
    server.close();
  }
}
