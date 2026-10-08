// Your legal page. Run it from your repo folder:
//
//   node tools/legal.mjs
//
// It writes site/privacy.html for the person in site/content.json: a legal
// notice with your name and email address (and your address, phone number
// and VAT number, if the content file has them), a privacy notice for a
// personal portfolio in the EU without tracking, and an accessibility
// statement, in English. It is the same command on every system. The
// Developer runs it at the end of its step; run it again whenever the
// content file's legal part changes.
import { fileURLToPath } from "node:url";
import { readContentFile } from "./check/content-file.mjs";
import { writeLegalPage } from "./legal/write-legal-page.mjs";

const siteDir = fileURLToPath(new URL("../site", import.meta.url));

const NO_EMAIL =
  "site/content.json has no email address, so the legal notice has a blank: the law asks for a way to reach whoever runs the site. " +
  "Add one as a mailto: link in links (the Analyst does it), then run this again.";
const NO_NAME =
  "site/content.json has no name, so the legal notice has a blank: the law asks who runs the site. " +
  "Add one as name (the Analyst does it), then run this again.";

async function run() {
  const { content, unreadable } = await readContentFile(siteDir);
  if (unreadable) {
    console.log(`Your legal page could not be written: ${unreadable.replace(/^content\.json/, "site/content.json")}`);
    console.log("A content file that is not valid JSON is the Analyst's to fix, in a fresh chat. Then run this again.");
    return 1;
  }
  const { blanks } = await writeLegalPage(siteDir, content);
  if (blanks.NAME && blanks.EMAIL) {
    console.log(
      `Your legal page is ready: site/privacy.html, with the legal notice for ${blanks.NAME} (${blanks.EMAIL}), the privacy notice and the accessibility statement.`,
    );
    return 0;
  }
  console.log("Your legal page is written: site/privacy.html, with the legal notice, the privacy notice and the accessibility statement. But it has a blank:");
  if (!blanks.NAME) console.log(NO_NAME);
  if (!blanks.EMAIL) console.log(NO_EMAIL);
  return 1;
}

const nodeMajor = Number(process.versions.node.split(".")[0]);

if (nodeMajor < 22) {
  console.log(`This needs Node 22 or newer; this is Node ${process.versions.node}.`);
  console.log("Run the install script again, or install the current Node LTS from nodejs.org.");
  process.exitCode = 1;
} else {
  try {
    process.exitCode = await run();
  } catch (error) {
    console.log(`Your legal page could not be written: ${error.message}.`);
    console.log("Nothing else was changed. Ask the instructor for help.");
    process.exitCode = 1;
  }
}
