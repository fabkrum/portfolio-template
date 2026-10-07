// The address the site is published at, which the build writes into the
// canonical link, the Open Graph tags and the sitemap. GitHub Pages publishes
// a repo at https://<owner>.github.io/<repo>/, and a repo named
// <owner>.github.io at https://<owner>.github.io/ itself.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// https://github.com/Owner/repo.git or git@github.com:Owner/repo.git
export function githubRepo(remote) {
  const match = remote.match(/^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return match && { owner: match[1], name: match[2] };
}

// A repo named like username.github.io is the site at the root address;
// any other repo is a folder under it.
export function pagesAddress({ owner, name }) {
  const host = `${owner.toLowerCase()}.github.io`;
  return name.toLowerCase() === host ? `https://${host}/` : `https://${host}/${name}/`;
}

// The site's own domain, from a CNAME file in the site folder, such as
// www.ada-example.dev; or null.
export function customDomain(siteDir) {
  let text;
  try {
    text = readFileSync(join(siteDir, "CNAME"), "utf8");
  } catch {
    return null;
  }
  const domain = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return domain && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? `https://${domain}/` : null;
}

// The repo's GitHub address, as Git on this computer knows it; or null.
function remoteOf(dir) {
  const result = spawnSync("git", ["config", "--get", "remote.origin.url"], { cwd: dir, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

// Where the site in siteDir is published: the domain in a CNAME file first;
// then, in GitHub Actions, the repo the workflow runs for; else the repo's
// GitHub address as Git knows it. Null when none of them says.
export function publicAddress(siteDir, env = process.env) {
  const domain = customDomain(siteDir);
  if (domain) return domain;
  const [owner, name] = (env.GITHUB_REPOSITORY ?? "").split("/");
  if (owner && name) return pagesAddress({ owner, name });
  const remote = remoteOf(siteDir);
  const repo = remote && githubRepo(remote);
  return repo ? pagesAddress(repo) : null;
}
