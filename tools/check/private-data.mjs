// Finds text in the content file that looks like a phone number or a postal
// address. The repo is public, so these must never be in it. A heuristic:
// it reports what looks suspicious; the person decides.

// Digits with spaces, dots, dashes, slashes or brackets between them.
const PHONE_CANDIDATE = /(?:\+|\b00)?\d[\d\s().\/-]{5,}\d/g;

const ADDRESS_PATTERNS = [
  // 12 Example Street, 3 Long Lane
  /\b\d{1,5}\s+(?:[A-Z][\p{L}'-]*\s+){1,3}(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Drive|Boulevard|Blvd\.?|Way|Court|Place|Square)(?=\W|$)/u,
  // Via Esempio 12, Rue de l'Exemple 4, Calle Ejemplo 7
  /\b(?:Via|Viale|Corso|Piazza|Piazzale|Vicolo|Largo|Rue|Calle|Avenida|Plaza|Rua)\s+(?:[\p{L}'.-]+\s+){1,4}\d{1,4}[a-z]?\b/u,
  // Beispielstraße 5, Musterweg 12a
  /[\p{L}-]+(?:straße|strasse|str\.|weg|gasse|allee|platz)\s+\d{1,4}[a-z]?\b/iu,
  // 20121 Milano, 10115 Berlin
  /\b\d{5}\s+[A-Z][\p{L}]+/u,
  // SW1A 1AA
  /\b[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}\b/,
];

const digitCount = (text) => text.replace(/\D/g, "").length;

function looksLikePhone(candidate) {
  const international = /^(\+|00)/.test(candidate);
  return digitCount(candidate) >= (international ? 8 : 9);
}

// Web links are checked only where they carry a phone number by design.
const isPlainWebLink = (text) =>
  /^https?:\/\//.test(text) && !/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(text);

function* textValues(value, path = []) {
  if (typeof value === "string") yield { path, text: value };
  else if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) yield* textValues(entry, [...path, index + 1]);
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) yield* textValues(entry, [...path, key]);
  }
}

export function findPrivateData(content) {
  const findings = [];
  for (const { path, text } of textValues(content)) {
    if (isPlainWebLink(text)) continue;
    const where = path.join(" > ");
    for (const [candidate] of text.matchAll(PHONE_CANDIDATE)) {
      if (looksLikePhone(candidate)) {
        findings.push(`${where}: "${candidate.trim()}" looks like a phone number.`);
      }
    }
    for (const pattern of ADDRESS_PATTERNS) {
      const match = text.match(pattern);
      if (match) findings.push(`${where}: "${match[0]}" looks like a postal address.`);
    }
  }
  return findings;
}
