// Photos for the tests: made in Chrome, with the hidden data a phone saves in
// a photo planted into them, and what a WebP file holds. The position is
// 0° N 0° E, a place in the sea: fake, like every fixture.
import { findChrome, launchChrome, openTab } from "../tools/check/chrome.mjs";

// What an expression gives back in a blank page of headless Chrome; it may be a promise.
export async function inBlankChrome(expression) {
  const chrome = await launchChrome(findChrome());
  try {
    const { sessionId } = await openTab(chrome.cdp);
    const { result, exceptionDetails } = await chrome.cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  } finally {
    await chrome.close();
  }
}

// A JPEG as a camera would take it: a sky, a sun and a hill, or, with
// halves, a left half in red and a right half in blue.
export async function jpegFromChrome({ width, height, halves = false }) {
  const dataUrl = await inBlankChrome(`(() => {
    const canvas = document.createElement("canvas");
    canvas.width = ${width};
    canvas.height = ${height};
    const context = canvas.getContext("2d");
    if (${halves}) {
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, ${width / 2}, ${height});
      context.fillStyle = "#0000ff";
      context.fillRect(${width / 2}, 0, ${width / 2}, ${height});
    } else {
      const sky = context.createLinearGradient(0, 0, 0, ${height});
      sky.addColorStop(0, "#3b82f6");
      sky.addColorStop(1, "#fde68a");
      context.fillStyle = sky;
      context.fillRect(0, 0, ${width}, ${height});
      context.fillStyle = "#f59e0b";
      context.beginPath();
      context.arc(${width * 0.7}, ${height * 0.3}, ${height * 0.12}, 0, 2 * Math.PI);
      context.fill();
      context.fillStyle = "#166534";
      context.beginPath();
      context.ellipse(${width * 0.4}, ${height}, ${width * 0.6}, ${height * 0.35}, 0, 0, 2 * Math.PI);
      context.fill();
    }
    return canvas.toDataURL("image/jpeg", 0.92);
  })()`);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

// A JPEG segment: its marker, its length and its data.
const segment = (marker, data) => {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(marker, 0);
  head.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([head, data]);
};

// EXIF as a phone writes it: the camera, the orientation and the GPS position.
function exif(orientation) {
  const tiff = Buffer.alloc(160);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  const entry = (at, tag, type, count, value) => {
    tiff.writeUInt16LE(tag, at);
    tiff.writeUInt16LE(type, at + 2);
    tiff.writeUInt32LE(count, at + 4);
    if (type === 3) tiff.writeUInt16LE(value, at + 8);
    else if (typeof value === "string") tiff.write(value, at + 8, "latin1");
    else tiff.writeUInt32LE(value, at + 8);
  };
  // The first directory: camera make, orientation, where the GPS directory is.
  tiff.writeUInt16LE(3, 8);
  entry(10, 0x010f, 2, 8, 50);
  entry(22, 0x0112, 3, 1, orientation);
  entry(34, 0x8825, 4, 1, 58);
  tiff.write("FakeCam\0", 50, "latin1");
  // The GPS directory: latitude and longitude, each three fractions of 0/1.
  tiff.writeUInt16LE(4, 58);
  entry(60, 0x0001, 2, 2, "N\0");
  entry(72, 0x0002, 5, 3, 112);
  entry(84, 0x0003, 2, 2, "E\0");
  entry(96, 0x0004, 5, 3, 136);
  for (let at = 112; at < 160; at += 8) tiff.writeUInt32LE(1, at + 4);
  return Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
}

const XMP = Buffer.from(
  'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="0,0.0N" exif:GPSLongitude="0,0.0E"/></rdf:RDF></x:xmpmeta>',
  "latin1",
);

// The planted words: none of them may reach a copy without the hidden data.
export const HIDDEN = ["Exif", "FakeCam", "GPSLatitude", "xmpmeta", "Taken at a secret place"];

// The JPEG with the hidden data a phone saves: EXIF with the camera, the
// orientation and the position, XMP with the position again, and a comment.
export function withHiddenData(jpeg, { orientation = 1 } = {}) {
  return Buffer.concat([
    jpeg.subarray(0, 2),
    segment(0xffe1, exif(orientation)),
    segment(0xffe1, XMP),
    segment(0xfffe, Buffer.from("Taken at a secret place", "latin1")),
    jpeg.subarray(2),
  ]);
}

// The chunks of a WebP file, by their four-letter names, such as VP8 and EXIF.
export function webpChunks(bytes) {
  if (bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WEBP") return null;
  const chunks = [];
  for (let at = 12; at + 8 <= bytes.length; at += 8 + bytes.readUInt32LE(at + 4) + (bytes.readUInt32LE(at + 4) % 2)) {
    chunks.push(bytes.toString("latin1", at, at + 4));
  }
  return chunks;
}

// The width and height a WebP file declares.
export function webpSize(bytes) {
  const kind = bytes.toString("latin1", 12, 16);
  if (kind === "VP8X") return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  if (kind === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  const bits = bytes.readUInt32LE(21);
  return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
}

// Whether a picture still holds where it was taken, in its EXIF or its XMP
// data: the photo tool's tests prove that its copy holds no position.
// Whether the EXIF data at this point, a TIFF structure, holds a GPS
// position: a GPS directory with a latitude or a longitude in it.
function exifHasPosition(bytes, start) {
  const order = bytes.toString("latin1", start, start + 2);
  if (order !== "II" && order !== "MM") return false;
  const u16 = (at) => (order === "II" ? bytes.readUInt16LE(start + at) : bytes.readUInt16BE(start + at));
  const u32 = (at) => (order === "II" ? bytes.readUInt32LE(start + at) : bytes.readUInt32BE(start + at));
  const tags = (directory) =>
    Array.from({ length: u16(directory) }, (_, index) => ({ tag: u16(directory + 2 + index * 12), value: u32(directory + 10 + index * 12) }));
  try {
    if (u16(2) !== 42) return false;
    const gps = tags(u32(4)).find(({ tag }) => tag === 0x8825);
    return Boolean(gps) && tags(gps.value).some(({ tag }) => tag === 2 || tag === 4);
  } catch {
    return false; // Not a whole TIFF structure: no position in it.
  }
}

// Where EXIF data may start: after "Exif\0\0" (JPEG, HEIC, AVIF), in a PNG's
// eXIf chunk, or in a WebP's EXIF chunk.
function exifStarts(bytes) {
  const starts = [];
  const each = (marker, skip) => {
    for (let at = bytes.indexOf(marker); at >= 0; at = bytes.indexOf(marker, at + 1)) starts.push(at + skip);
  };
  each("Exif\0\0", 6);
  each("eXIf", 4);
  each("EXIF", 8);
  return starts;
}

// Whether a picture holds where it was taken, in its EXIF or its XMP data.
export const holdsPosition = (bytes) =>
  bytes.includes("GPSLatitude") || bytes.includes("GPSLongitude") || exifStarts(bytes).some((start) => exifHasPosition(bytes, start));
