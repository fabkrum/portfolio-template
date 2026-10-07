// The build. Run it from your repo folder:
//
//   node tools/build.mjs
//
// It turns the site in site/ into the finished site, in the folder _site/:
// the content of site/content.json goes into the pages themselves, so they
// show it without JavaScript and search engines and AI agents can read it.
// Every page gets its title, description and link preview, and robots.txt,
// sitemap.xml and llms.txt go next to the pages. The preview, look, the Check
// and publishing on GitHub build the site the same way, by themselves.
import { fileURLToPath } from "node:url";
import { BuildError, buildSite } from "./build/build-site.mjs";
import { publicAddress } from "./build/public-address.mjs";

const siteDir = fileURLToPath(new URL("../site", import.meta.url));
const outDir = fileURLToPath(new URL("../_site", import.meta.url));

function report({ address, pages, files, warnings }) {
  console.log("Built your site into the folder _site/, with the content of site/content.json in its pages.");
  console.log(
    address
      ? `Its address: ${address}`
      : "Its address is not known here, because this folder is not connected to a repo on GitHub. The build on GitHub knows it, and adds what needs it: the page's own address for search engines, the photo in link previews and sitemap.xml.",
  );
  console.log(`Pages: ${pages.join(", ")}`);
  console.log(`For search engines and AI agents: ${["robots.txt", "sitemap.xml", "llms.txt"].filter((file) => files.includes(file)).join(", ")}`);
  if (warnings.length > 0) {
    console.log("\nNeeds your attention:");
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
}

const nodeMajor = Number(process.versions.node.split(".")[0]);

if (nodeMajor < 22) {
  console.log(`This needs Node 22 or newer; this is Node ${process.versions.node}.`);
  console.log("Run the install script again, or install the current Node LTS from nodejs.org.");
  process.exitCode = 1;
} else {
  try {
    // On GitHub, GITHUB_SHA is the commit the site is built from: tools/live.mjs
    // reads it back from version.txt to tell whether the newest version is online.
    report(await buildSite(siteDir, outDir, { address: publicAddress(siteDir), commit: process.env.GITHUB_SHA || null }));
  } catch (error) {
    if (error instanceof BuildError) {
      console.log(`Your site could not be built: ${error.message}`);
      console.log("Nothing was written into _site/. Fix it, then run node tools/build.mjs again.");
    } else {
      console.log(`The build itself ran into a problem: ${error.message}`);
    }
    // Not 0, so that publishing stops here and the version online stays as it is.
    process.exitCode = 1;
  }
}
