import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundledFonts } from "../tools/fonts/bundled-fonts.mjs";
import { inChrome } from "./in-chrome.js";
import { templateDir, withRepo } from "./participant-repo.js";

const fontsDir = join(templateDir, "fonts");
// Git on Windows may check files out with CRLF line endings.
const readText = async (path) => (await readFile(path, "utf8")).replaceAll("\r\n", "\n");

// The two fonts of each style, as the Designer's phrase bank names them.
const STYLE_FONTS = {
  Classic: ["Newsreader", "Literata"],
  Modern: ["Geist", "JetBrains Mono"],
  Bold: ["Anton", "Work Sans"],
  Playful: ["Bricolage Grotesque", "Rubik"],
  Technical: ["JetBrains Mono", "IBM Plex Sans"],
};

test("the font folder holds the two fonts of each style, and nothing else", async () => {
  const names = (await bundledFonts(templateDir)).map(({ name }) => name).sort();
  assert.deepEqual(names, [...new Set(Object.values(STYLE_FONTS).flat())].sort());
});

for (const family of await bundledFonts(templateDir)) {
  test(`${family.name} is WOFF2 with its licence, its @font-face rules and a note of where it comes from`, async () => {
    const fonts = family.files.filter((file) => file.endsWith(".woff2"));
    assert.ok(fonts.length > 0, "no font file");
    for (const file of fonts) {
      const bytes = await readFile(join(family.dir, file));
      assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2", `${file} is not WOFF2`);
    }
    // The SIL Open Font License 1.1, with the font's copyright line on top.
    const licence = await readText(join(family.dir, "OFL.txt"));
    assert.match(licence.split("\n")[0], /^Copyright/);
    assert.match(licence, /SIL OPEN FONT LICENSE Version 1\.1/);
    // Each rule serves one file of this folder, from the site's copy of it, and swaps in when it is there.
    const urls = [...family.rules.matchAll(/url\("([^"]+)"\)/g)].map(([, url]) => url);
    assert.deepEqual(urls.sort(), fonts.map((file) => `fonts/${family.folder}/${file}`).sort());
    assert.equal(family.rules.match(/font-display: swap;/g)?.length, fonts.length);
    for (const name of family.rules.matchAll(/font-family: "([^"]+)";/g)) assert.equal(name[1], family.name);
    const readme = await readText(join(family.dir, "README.md"));
    for (const needed of [`# ${family.name}`, "Version:", "Source:", "Licence: SIL Open Font License 1.1", "OFL.txt"]) {
      assert.ok(readme.includes(needed), needed);
    }
  });
}

test("the font folder stays small: under 600 KB of fonts for all five styles", async () => {
  let bytes = 0;
  for (const family of await bundledFonts(templateDir)) {
    for (const file of family.files) bytes += (await stat(join(family.dir, file))).size;
  }
  assert.ok(bytes < 600 * 1024, `${Math.round(bytes / 1024)} KB`);
});

test("the fonts live outside site/, so only the ones a site uses are published", () => {
  assert.ok(existsSync(fontsDir));
  assert.ok(!existsSync(join(templateDir, "site", "assets", "fonts")));
});

// The one command, run the way the build skill runs it: from the repo folder.
const fontsCommand = (dir, cwd = dir) => spawnSync(process.execPath, [join(dir, "tools", "fonts.mjs")], { cwd, encoding: "utf8" });

// A brief with these font stacks in its Type table.
async function briefWithFonts(dir, { headings, body, details }) {
  const brief = await readText(join(templateDir, "tests", "fixtures", "design", "briefs", "from-stitch-html.md"));
  const rows = brief
    .replace(/^\| headings \| [^|]* \|/m, `| headings | ${headings} |`)
    .replace(/^\| body \| [^|]* \|(.*)\n/m, `| body | ${body} |$1\n${details ? `| details | ${details} | 0.875rem | 400 |\n` : ""}`);
  await writeFile(join(dir, "design", "brief.md"), rows);
}

const siteFonts = async (dir) => {
  const folder = join(dir, "site", "assets", "fonts");
  if (!existsSync(folder)) return [];
  return (await readdir(folder, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(folder.length + 1).replaceAll("\\", "/"))
    .sort();
};

test("the command copies the fonts the brief names into the site, each with its licence, and prints their @font-face rules", async () => {
  await withRepo(async (dir) => {
    await briefWithFonts(dir, {
      headings: '"Geist", system-ui, sans-serif',
      body: '"Geist", system-ui, sans-serif',
      details: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
    });
    const { status, stdout } = fontsCommand(dir);
    assert.equal(status, 0, stdout);
    assert.deepEqual(await siteFonts(dir), [
      "geist/OFL.txt", "geist/geist-latin-wght-normal.woff2",
      "jetbrains-mono/OFL.txt", "jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2",
    ]);
    for (const file of ["geist/geist-latin-wght-normal.woff2", "jetbrains-mono/OFL.txt"]) {
      assert.ok((await readFile(join(dir, "site", "assets", "fonts", file))).equals(await readFile(join(fontsDir, file))), file);
    }
    for (const folder of ["geist", "jetbrains-mono"]) {
      // Geist is named twice, its rules come once.
      const rules = (await readText(join(fontsDir, folder, "font-face.css"))).trim();
      assert.equal(stdout.split(rules).length, 2, `${folder}: ${stdout}`);
    }
    assert.match(stdout, /site\/assets\/styles\.css/);
    assert.doesNotMatch(stdout, /not one of/);
  });
});

test("a web font that is not bundled is named, with what the page shows instead; a font every computer has needs nothing", async () => {
  await withRepo(async (dir) => {
    await briefWithFonts(dir, { headings: '"Plus Jakarta Sans", system-ui, sans-serif', body: 'Georgia, "Times New Roman", serif' });
    const { status, stdout } = fontsCommand(dir);
    assert.equal(status, 0, stdout);
    assert.deepEqual(await siteFonts(dir), []);
    assert.match(stdout, /"Plus Jakarta Sans"/);
    assert.match(stdout, /system-ui/);
    assert.match(stdout, /Georgia.*every computer/);
    assert.doesNotMatch(stdout, /@font-face/);
  });
});

test("run twice, the command gives the same site and says the same", async () => {
  await withRepo(async (dir) => {
    await briefWithFonts(dir, { headings: '"Newsreader", Georgia, serif', body: '"Literata", Georgia, serif' });
    const first = fontsCommand(dir);
    const files = await siteFonts(dir);
    const second = fontsCommand(dir);
    assert.equal(second.stdout, first.stdout);
    assert.deepEqual(await siteFonts(dir), files);
    assert.ok(files.includes("newsreader/newsreader-latin-wght-italic.woff2"));
  });
});

test("the command works on its own repo, from whichever folder it is run, and says plainly when there is no brief", async () => {
  await withRepo(async (dir) => {
    await briefWithFonts(dir, { headings: '"Anton", Impact, sans-serif', body: '"Work Sans", system-ui, sans-serif' });
    const run = fontsCommand(dir, tmpdir());
    assert.equal(run.status, 0, run.stdout);
    assert.deepEqual(await siteFonts(dir), ["anton/OFL.txt", "anton/anton-latin-400-normal.woff2", "work-sans/OFL.txt", "work-sans/work-sans-latin-wght-normal.woff2"]);
    await writeFile(join(dir, "design", "brief.md"), "");
    const empty = fontsCommand(dir);
    assert.equal(empty.status, 0);
    assert.match(empty.stdout, /names no fonts/);
  });
});

// The Developer's checkpoint, run the way a participant runs it.
const jumpTo = (dir, block) => spawnSync(process.execPath, [join(dir, "tools", "checkpoint.mjs"), block], { cwd: dir, encoding: "utf8" });

// Which of these fonts the page in the site folder has loaded, once its fonts are in.
const loadedIn = (dir, families) =>
  inChrome(join(dir, "site"), `document.fonts.ready.then(() => ${JSON.stringify(families)}.filter((family) => document.fonts.check(\`1rem "\${family}"\`) && [...document.fonts].some((face) => face.family.replaceAll('"', "") === family && face.status === "loaded")))`);

test("the Developer's checkpoint serves and loads the fonts of the default design, and says nothing about fonts", async () => {
  await withRepo(async (dir) => {
    const { status, stdout } = jumpTo(dir, "developer");
    assert.equal(status, 0, stdout);
    assert.deepEqual(await siteFonts(dir), [
      "literata/OFL.txt", "literata/literata-latin-wght-italic.woff2", "literata/literata-latin-wght-normal.woff2",
      "newsreader/OFL.txt", "newsreader/newsreader-latin-wght-italic.woff2", "newsreader/newsreader-latin-wght-normal.woff2",
    ]);
    assert.match(stdout, /site\/assets\/fonts\/newsreader\/OFL\.txt – the licence of the font beside it/);
    assert.match(stdout, /site\/assets\/fonts\/newsreader\/newsreader-latin-wght-normal\.woff2 – a font of the design, served from your own site/);
    assert.doesNotMatch(stdout, /names the font/);
    assert.deepEqual(await loadedIn(dir, ["Newsreader", "Literata"]), ["Newsreader", "Literata"]);
  });
});

test("with a brief in the Bold style, the Developer's checkpoint serves and loads its bundled fonts, the details font too", async () => {
  await withRepo(async (dir) => {
    await briefWithFonts(dir, {
      headings: '"Anton", Impact, "Arial Narrow", sans-serif',
      body: '"Work Sans", system-ui, sans-serif',
      details: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
    });
    const { status, stdout } = jumpTo(dir, "developer");
    assert.equal(status, 0, stdout);
    assert.deepEqual(await siteFonts(dir), [
      "anton/OFL.txt", "anton/anton-latin-400-normal.woff2",
      "jetbrains-mono/OFL.txt", "jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2",
      "work-sans/OFL.txt", "work-sans/work-sans-latin-wght-normal.woff2",
    ]);
    const css = await readText(join(dir, "site", "assets", "styles.css"));
    assert.ok(css.includes('--font-details: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;'));
    // Only the rules of the fonts it uses: not the default design's.
    assert.doesNotMatch(css, /font-family: "(Newsreader|Literata)"/);
    assert.match(stdout, /colours and fonts of your design brief/);
    assert.doesNotMatch(stdout, /names the font/);
    assert.deepEqual(await loadedIn(dir, ["Anton", "Work Sans", "JetBrains Mono"]), ["Anton", "Work Sans", "JetBrains Mono"]);
    // Applied again, nothing changes.
    assert.match(jumpTo(dir, "developer").stdout, /Nothing to change/);
  });
});

test("on a stylesheet with Windows line endings, the checkpoint writes the font rules with Windows line endings too", async () => {
  await withRepo(async (dir) => {
    // Git on Windows checks the checkpoint's stylesheet out with CRLF.
    const stored = join(dir, "checkpoints", "developer", "site", "assets", "styles.css");
    await writeFile(stored, (await readText(stored)).replaceAll("\n", "\r\n"));
    assert.equal(jumpTo(dir, "developer").status, 0);
    const css = await readFile(join(dir, "site", "assets", "styles.css"), "utf8");
    assert.match(css, /font-family: "Newsreader";/);
    assert.equal(css.split("\n").length, css.split("\r\n").length, "every line ends in CRLF");
  });
});
