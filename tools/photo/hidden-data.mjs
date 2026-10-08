// Whether a picture still holds where it was taken. The photo tool's tests use
// it to prove that node tools/photo.mjs saves a copy without that hidden data.

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
