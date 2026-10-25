#!/bin/sh
# The Install script for macOS and Linux. Paste one line into the Terminal:
#
#   macOS:  curl -fsSL https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.sh | sh
#   Linux:  wget -qO- https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.sh | sh
#
# It checks Google Chrome and installs the GitHub CLI, Git, Node and the
# Antigravity CLI where they are missing. With one sign-in to GitHub in the
# browser, it creates your portfolio repo from the workshop's template,
# switches GitHub Pages on and lets git push use that sign-in. It downloads
# Chrome DevTools for agents for the QA role, puts your repo in your home
# folder, sets the Antigravity CLI up for the workshop, checks your Gemini
# quota and starts the Antigravity CLI in your repo. It is safe to run again at
# any time.
#
# Without a terminal, or when the GitHub sign-in does not work, it asks for
# your GitHub username instead, and you make the repo on github.com.
# PORTFOLIO_GITHUB_USER and PORTFOLIO_REPO answer that up front, without the
# GitHub CLI. PORTFOLIO_UNATTENDED=1 signs in to nothing and starts nothing,
# and PORTFOLIO_AGY_INSTALLER names another installer for the Antigravity CLI
# (the automated tests use all four).
#
# In a workshop, the guide's line also names the event, in front of sh:
# WORKSHOP_EVENT, WORKSHOP_DATE (YYYY-MM-DD) and WORKSHOP_CITY. The script
# saves them in workshop.json in your repo, where the Analyst finds them.
# WORKSHOP_START and WORKSHOP_END (HH:MM), when the line names them, let the
# Role clock follow the room (tools/clock.mjs):
#
#   ... | WORKSHOP_EVENT="DevFest Milano 2026" WORKSHOP_DATE=2026-10-10 WORKSHOP_CITY=Milan sh

set -u

NODE_MIN=22
NODE_HOME="$HOME/.local/node"
MARK="# added by the portfolio install script"
STARTING_PATH=$PATH
NEXT=""
NEW_TERMINAL=0

case "$(uname -s)" in
  Darwin) OS=darwin ;;
  Linux) OS=linux ;;
  *) OS=other ;;
esac

WORK=$(mktemp -d 2>/dev/null || mktemp -d -t portfolio 2>/dev/null)
if [ -z "$WORK" ]; then
  WORK="$HOME/.portfolio-install.$$"
  mkdir -p "$WORK"
fi
trap 'rm -rf "$WORK"' EXIT

ok() { printf '  [ok]    %s\n' "$1"; }
info() { printf '          %s\n' "$1"; }
# A problem and the one thing the participant should do about it.
todo() {
  printf '  [to do] %s\n' "$1"
  printf '          %s\n' "$2"
  NEXT="$NEXT$2
"
}
heading() { printf '\n%s\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

fetch() {
  if have curl; then curl -fsSL --retry 2 -o "$2" "$1"
  elif have wget; then wget -q -O "$2" "$1"
  else return 1; fi
}

page_exists() {
  if have curl; then curl -fsSIL -o /dev/null "$1"
  elif have wget; then wget -q --spider "$1"
  else return 1; fi
}

sha256_of() {
  if have sha256sum; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# ---------------------------------------------------------------- questions

ask_github_user() {
  GH_USER=${PORTFOLIO_GITHUB_USER:-}
  REPO=${PORTFOLIO_REPO:-portfolio}
  if [ -z "$GH_USER" ] && (: </dev/tty) 2>/dev/null; then
    printf 'What is your GitHub username? '
    read -r GH_USER </dev/tty
  fi
  # Accept a pasted link such as https://github.com/ada/portfolio as well.
  GH_USER=$(printf '%s' "$GH_USER" | tr -d ' ')
  GH_USER=${GH_USER#https://}
  GH_USER=${GH_USER#http://}
  GH_USER=${GH_USER#github.com/}
  GH_USER=${GH_USER#@}
  case $GH_USER in
    */*)
      REPO=${GH_USER#*/}
      REPO=${REPO%%/*}
      REPO=${REPO%.git}
      GH_USER=${GH_USER%%/*}
      ;;
  esac
  case $GH_USER in
    '' | *[!A-Za-z0-9-]*) return 1 ;;
  esac
  valid_repo_name "$REPO" || return 1
  set_repo "$REPO"
}

valid_repo_name() {
  case $1 in
    '' | . | .. | *[!A-Za-z0-9._-]*) return 1 ;;
  esac
}

# The repo, its folder in the home folder and its address on GitHub.
set_repo() {
  REPO=$1
  REPO_DIR="$HOME/$REPO"
  REPO_URL="https://github.com/$GH_USER/$REPO"
}

# The address GitHub Pages publishes the repo at.
site_url() {
  if [ "$REPO" = "$GH_USER.github.io" ]; then echo "https://$GH_USER.github.io/"
  else echo "https://$GH_USER.github.io/$REPO/"; fi
}

# ------------------------------------------------------------ desktop apps

check_chrome() {
  if [ "$OS" = darwin ]; then
    for app in "/Applications/Google Chrome.app" "$HOME/Applications/Google Chrome.app"; do
      if [ -d "$app" ]; then ok "Google Chrome is installed."; return 0; fi
    done
  else
    for name in google-chrome google-chrome-stable; do
      if have "$name"; then ok "Google Chrome is installed."; return 0; fi
    done
    for name in chromium chromium-browser; do
      if have "$name"; then ok "Chromium is installed (the Check can use it instead of Chrome)."; return 0; fi
    done
  fi
  todo "Google Chrome is not installed." \
    "Install Google Chrome from https://www.google.com/chrome/ (the Check uses it), then run this command again."
}

# ----------------------------------------------------------------- GitHub

# The workshop's template, which every participant's repo is a copy of.
TEMPLATE_REPO=fabkrum/portfolio-template
GH_HOME="$HOME/.local/gh"
GH_SIGNED_IN=0

# The GitHub CLI does the GitHub steps when someone is there to click
# "Authorize" in the browser: in a terminal, and with no username given up front.
wants_github_cli() {
  [ -z "${PORTFOLIO_GITHUB_USER:-}" ] && [ -z "${PORTFOLIO_UNATTENDED:-}" ] && [ -t 1 ] && (: </dev/tty) 2>/dev/null
}

# The newest release from github.com/cli/cli, checked against its checksums,
# into ~/.local/gh: no admin rights needed. The version comes from where the
# releases/latest page leads, not from GitHub's API, which allows a room
# behind one address only 60 calls an hour.
download_gh() {
  if have curl; then
    latest=$(curl -fsSIL -o /dev/null -w '%{url_effective}' https://github.com/cli/cli/releases/latest)
  else
    latest=$(wget -S --spider --max-redirect=0 https://github.com/cli/cli/releases/latest 2>&1 | sed -n 's/^ *Location: *//p' | tr -d '\r' | tail -n 1)
  fi
  version=${latest##*/v}
  case $version in '' | *[!0-9.]*) return 1 ;; esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) return 1 ;;
  esac
  if [ "$OS" = darwin ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = 1 ]; then arch=arm64; fi
  if [ "$OS" = darwin ]; then name="gh_${version}_macOS_$arch"; file="$name.zip"; else name="gh_${version}_linux_$arch"; file="$name.tar.gz"; fi
  base="https://github.com/cli/cli/releases/download/v$version"
  fetch "$base/$file" "$WORK/$file" || return 1
  fetch "$base/gh_${version}_checksums.txt" "$WORK/gh-checksums.txt" || return 1
  expected=$(grep " $file\$" "$WORK/gh-checksums.txt" | cut -d' ' -f1)
  if [ -z "$expected" ] || [ "$expected" != "$(sha256_of "$WORK/$file")" ]; then return 1; fi
  rm -rf "$WORK/gh"
  mkdir "$WORK/gh"
  if [ "$OS" = darwin ]; then unzip -q "$WORK/$file" -d "$WORK/gh" || return 1
  else tar -xzf "$WORK/$file" -C "$WORK/gh" || return 1; fi
  [ -x "$WORK/gh/$name/bin/gh" ] || return 1
  mkdir -p "$HOME/.local"
  rm -rf "$GH_HOME"
  mv "$WORK/gh/$name" "$GH_HOME"
}

use_gh_home() {
  add_to_new_terminals .local/gh/bin
  PATH="$GH_HOME/bin:$PATH"
  export PATH
}

gh_version() { gh --version | sed -n '1s/^gh version \([^ ]*\).*/gh \1/p'; }

ensure_gh() {
  if ! have gh && [ -x "$GH_HOME/bin/gh" ]; then use_gh_home; fi
  if have gh; then
    ok "The GitHub CLI is installed ($(gh_version))."
    return 0
  fi
  info "Installing the GitHub CLI..."
  if download_gh; then
    use_gh_home
    ok "Installed the GitHub CLI ($(gh_version))."
    return 0
  fi
  info "The GitHub CLI could not be installed. That is fine: you do the GitHub steps on github.com instead."
  return 1
}

# One sign-in in the browser: the GitHub CLI shows a code (on a Mac it is
# copied already), the browser opens GitHub's page for it, the participant
# pastes it and clicks Authorize. Without its questions, the GitHub CLI asks
# nothing in the terminal; Git gets the sign-in afterwards. It keeps the
# sign-in in the system's keychain, and git push uses it at Ops.
open_in_browser() {
  if [ "$OS" = darwin ]; then open "$1" >/dev/null 2>&1
  elif have xdg-open; then xdg-open "$1" >/dev/null 2>&1
  else return 1; fi
}

github_sign_in() {
  if ! gh auth status --hostname github.com >/dev/null 2>&1; then
    info "Now sign in to GitHub. Your browser opens github.com/login/device: paste the code shown below (on a Mac it is copied already), click Continue, then Authorize."
    info "If the browser does not open, open https://github.com/login/device yourself."
    ( sleep 2; open_in_browser https://github.com/login/device ) &
    GH_PROMPT_DISABLED=1 gh auth login --hostname github.com --git-protocol https --web --scopes workflow </dev/null
    if ! gh auth status --hostname github.com >/dev/null 2>&1; then
      info "The sign-in to GitHub did not work. That is fine: you do the GitHub steps on github.com instead."
      return 1
    fi
  fi
  GH_USER=$(gh api user --jq .login 2>/dev/null)
  [ -n "$GH_USER" ] || return 1
  GH_SIGNED_IN=1
  ok "Signed in to GitHub as $GH_USER."
}

# The participant's repo on GitHub: used when it is a copy of the template,
# created from the template when it is missing. A repo of that name that is
# something else, such as a live site, stays as it is: the new repo gets
# another name. Says "existing" or "created", or nothing after a to-do.
github_repo() {
  tries=0
  while [ "$tries" -lt 3 ]; do
    tries=$((tries + 1))
    if made_from=$(gh api "repos/$GH_USER/$REPO" --jq '.template_repository.full_name // ""' 2>"$WORK/gh-repo.err"); then
      if [ "$made_from" = "$TEMPLATE_REPO" ]; then
        ok "Your repo is on GitHub: $REPO_URL" >&2
        echo existing
        return 0
      fi
      info "You already have a repo called $REPO on GitHub, and it is not a copy of the workshop's template. It stays as it is." >&2
      suggested="$REPO-2026"
      printf '          Name for your new repo [%s]: ' "$suggested" >&2
      answer=""
      read -r answer </dev/tty
      printf '\n' >&2
      answer=$(printf '%s' "${answer:-$suggested}" | tr -d ' ')
      if ! valid_repo_name "$answer"; then answer=$suggested; fi
      set_repo "$answer"
      continue
    fi
    if ! grep -q "404" "$WORK/gh-repo.err"; then
      todo "GitHub did not answer about your repo." "Check your internet connection, then run this command again." >&2
      return 1
    fi
    if ! gh repo create "$REPO" --template "$TEMPLATE_REPO" --public >/dev/null 2>&1; then
      todo "Your repo could not be created on GitHub." "Check your internet connection, then run this command again." >&2
      return 1
    fi
    # GitHub copies the template's files a moment after the repo exists.
    waited=0
    while [ "$waited" -lt 30 ] && ! gh api "repos/$GH_USER/$REPO/contents/site/content.json" >/dev/null 2>&1; do
      sleep 1
      waited=$((waited + 1))
    done
    ok "Created your repo $REPO_URL from the workshop's template." >&2
    echo created
    return 0
  done
  todo "No free name for your repo was found." "Run this command again and type another name when it asks." >&2
  return 1
}

# Pages publishes the site with the repo's deploy workflow. Creating the repo
# already started that deploy, possibly before Pages was on, so a new repo
# gets one more.
switch_on_pages() {
  gh api --method POST "repos/$GH_USER/$REPO/pages" -f build_type=workflow >/dev/null 2>&1
  if [ "$1" = created ]; then gh workflow run deploy.yml -R "$GH_USER/$REPO" >/dev/null 2>&1; fi
  ok "GitHub Pages is on: your site goes live at $(site_url) a minute after each push."
}

set_up_github() {
  if wants_github_cli && ensure_gh && github_sign_in; then
    set_repo "${PORTFOLIO_REPO:-portfolio}"
    valid_repo_name "$REPO" || set_repo portfolio
    github_repo >"$WORK/gh-repo.state"
    state=$(cat "$WORK/gh-repo.state")
    if [ -n "$state" ]; then switch_on_pages "$state"; fi
    return 0
  fi
  if ! ask_github_user; then
    printf '\nThat does not look like a GitHub username: "%s".\n' "$GH_USER${REPO:+/$REPO}"
    printf 'Run this command again and type just your username, for example: ada-lovelace\n'
    exit 1
  fi
}

# git push uses the GitHub CLI's sign-in, and commits get the account's name
# and its noreply address, which keeps the participant's own email address out
# of the public repo. A name and address Git has already stay.
set_up_git_for_github() {
  [ "$GH_SIGNED_IN" = 1 ] && [ "$HAVE_GIT" = 1 ] || return 0
  gh auth setup-git >/dev/null 2>&1
  if [ -z "$(git config --global user.name)" ]; then
    git config --global user.name "$(gh api user --jq '.name // .login')"
  fi
  if [ -z "$(git config --global user.email)" ]; then
    git config --global user.email "$(gh api user --jq .id)+$GH_USER@users.noreply.github.com"
  fi
  ok "git push uses your GitHub sign-in."
}

# --------------------------------------------------------------------- Git

HAVE_GIT=0
git_works() {
  have git || return 1
  # On a fresh Mac, /usr/bin/git is a stub until the developer tools exist;
  # running it would pop up a window, so ask xcode-select instead.
  if [ "$OS" = darwin ] && [ "$(command -v git)" = /usr/bin/git ] && ! xcode-select -p >/dev/null 2>&1; then
    return 1
  fi
  git --version >/dev/null 2>&1
}

as_admin() {
  if [ "$(id -u)" = 0 ]; then "$@"
  elif have sudo; then sudo "$@"
  else return 1; fi
}

install_linux_package() {
  if [ "$(id -u)" != 0 ] && have sudo && ! sudo -n true 2>/dev/null; then
    info "Your computer asks for your password now: the one you use to log in."
    info "Nothing appears while you type it. Press Enter when you are done."
  fi
  if have apt-get; then
    as_admin apt-get update -qq >/dev/null 2>&1
    as_admin env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$1" >/dev/null
  elif have dnf; then as_admin dnf install -y -q "$1" >/dev/null
  elif have pacman; then as_admin pacman -S --noconfirm --needed "$1" >/dev/null
  elif have zypper; then as_admin zypper --non-interactive --quiet install "$1" >/dev/null
  else return 1; fi
}

ensure_git() {
  if git_works; then
    HAVE_GIT=1
    ok "Git is installed ($(git --version))."
    return 0
  fi
  if [ "$OS" = darwin ]; then
    xcode-select --install >/dev/null 2>&1
    todo "Git is not installed yet. It comes with Apple's command line developer tools." \
      "A window asks you to install the command line developer tools: click Install and wait until it is done (about 5 minutes). Then run this command again."
    return 1
  fi
  info "Installing Git..."
  if install_linux_package git && git_works; then
    HAVE_GIT=1
    ok "Git is installed ($(git --version))."
    return 0
  fi
  todo "Git could not be installed." \
    "Install Git with your system's software app (search for \"git\"), or ask the instructor. Then run this command again."
}

# -------------------------------------------------------------------- Node

node_major() {
  "$1" --version 2>/dev/null | sed -n 's/^v\([0-9][0-9]*\)\..*/\1/p'
}

node_is_new_enough() {
  major=$(node_major "$1")
  [ -n "$major" ] && [ "$major" -ge "$NODE_MIN" ]
}

# Downloads the current Node LTS from nodejs.org into ~/.local/node. No admin
# rights needed, and it does not touch any other Node on the machine.
download_node() {
  case "$(uname -m)" in
    x86_64 | amd64) arch=x64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) return 1 ;;
  esac
  # A Terminal running under Rosetta reports x86_64 on an Apple silicon Mac.
  if [ "$OS" = darwin ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = 1 ]; then arch=arm64; fi
  fetch https://nodejs.org/dist/index.json "$WORK/index.json" || return 1
  version=$(awk '/"lts":"/ { print; exit }' "$WORK/index.json" | sed 's/.*"version":"\(v[0-9.]*\)".*/\1/')
  [ -n "$version" ] || return 1
  file="node-$version-$OS-$arch.tar.gz"
  fetch "https://nodejs.org/dist/$version/$file" "$WORK/$file" || return 1
  fetch "https://nodejs.org/dist/$version/SHASUMS256.txt" "$WORK/SHASUMS256.txt" || return 1
  expected=$(grep " $file\$" "$WORK/SHASUMS256.txt" | cut -d' ' -f1)
  if [ -z "$expected" ] || [ "$expected" != "$(sha256_of "$WORK/$file")" ]; then return 1; fi
  mkdir -p "$HOME/.local"
  rm -rf "$NODE_HOME.partial"
  mkdir "$NODE_HOME.partial"
  tar -xzf "$WORK/$file" -C "$NODE_HOME.partial" --strip-components=1 || return 1
  rm -rf "$NODE_HOME"
  mv "$NODE_HOME.partial" "$NODE_HOME"
}

# New terminals find a folder in the home folder ($1) first. Each start-up
# file gets one line for it, once.
add_to_new_terminals() {
  # shellcheck disable=SC2016 # $HOME and $PATH are meant for the start-up file
  line='export PATH="$HOME/'"$1"':$PATH" '"$MARK"
  for file in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.bash_profile"; do
    # A new ~/.bash_profile would stop bash from reading ~/.profile.
    if [ "$file" = "$HOME/.bash_profile" ] && [ ! -f "$file" ]; then continue; fi
    if ! grep -qF "$line" "$file" 2>/dev/null; then
      printf '\n%s\n' "$line" >>"$file"
    fi
  done
  case ":$STARTING_PATH:" in
    *":$HOME/$1:"*) ;;
    *) NEW_TERMINAL=1 ;;
  esac
}

ensure_node() {
  if have node && node_is_new_enough node; then
    ok "Node is installed ($(node --version))."
    return 0
  fi
  if have node; then
    info "Your Node is $(node --version 2>/dev/null); the Check needs $NODE_MIN or newer."
  fi
  if ! node_is_new_enough "$NODE_HOME/bin/node"; then
    info "Downloading Node from nodejs.org..."
    if ! download_node; then
      todo "Node could not be installed." \
        "Install the LTS version from https://nodejs.org (the Check needs it), then run this command again."
      return 1
    fi
  fi
  add_to_new_terminals .local/node/bin
  PATH="$NODE_HOME/bin:$PATH"
  export PATH
  ok "Node is installed ($(node --version))."
}

# ---------------------------------------------- Chrome DevTools for agents

# The package and version .agents/mcp_config.json starts;
# tests/devtools.test.js keeps the two the same.
DEVTOOLS_PACKAGE=chrome-devtools-mcp@1.10.1

# Runs a command for at most $1 seconds, with nothing to read and its output
# thrown away. Fails if the command fails or has to be stopped: first asked to
# stop, then forced 5 seconds later. The watchdog ends by itself once the
# command is gone, and the 2>/dev/null on wait keeps the shell from printing
# "Terminated" when the time runs out.
run_at_most() {
  seconds=$1
  shift
  "$@" </dev/null >/dev/null 2>&1 &
  pid=$!
  (
    waited=0
    while kill -0 "$pid" 2>/dev/null; do
      if [ "$waited" -eq "$seconds" ]; then kill "$pid"; fi
      if [ "$waited" -ge "$((seconds + 5))" ]; then kill -9 "$pid"; fi
      sleep 1
      waited=$((waited + 1))
    done
  ) >/dev/null 2>&1 &
  watchdog=$!
  wait "$pid" 2>/dev/null
  exit_code=$?
  wait "$watchdog"
  return "$exit_code"
}

# Starts the server from the npm cache alone, offline, the way Antigravity
# will: it succeeds only if the server is there and runs on this laptop. The
# first start unpacks it from the cache; stopped half-way through that, npx
# would keep a broken copy for good. Offline it never waits for the network,
# so it gets all the time a slow laptop needs.
devtools_runs() {
  have npx && run_at_most 300 npx --offline -y "$DEVTOOLS_PACKAGE" --version
}

# The Antigravity CLI starts Chrome DevTools for agents with npx, from the npm
# cache. Putting it there now means nothing is downloaded during the QA block.
# If it is there already, nothing is downloaded now either. The download runs
# on its own, so stopping it half-way, at the time limit or with Ctrl+C,
# leaves nothing broken behind. QA works without it, so this never stops the
# script.
prepare_devtools() {
  node_is_new_enough node || return 0
  case $(node --version) in
    v22.[0-9].* | v22.1[01].*)
      info "Chrome DevTools for agents needs Node 22.12 or newer, and you have $(node --version)."
      info "The QA role works without it. To get it anyway, install the LTS version from https://nodejs.org, then run this command again."
      return 0
      ;;
  esac
  if devtools_runs; then
    ok "Chrome DevTools for agents is ready."
    return 0
  fi
  info "Downloading Chrome DevTools for agents for the QA role..."
  if run_at_most 180 npm cache add "$DEVTOOLS_PACKAGE" && devtools_runs; then
    ok "Chrome DevTools for agents is ready."
  else
    info "Chrome DevTools for agents could not be set up. That is fine: the QA role works without it."
  fi
}

# ------------------------------------------------------ Antigravity CLI

AGY_INSTALLER=${PORTFOLIO_AGY_INSTALLER:-https://antigravity.google/cli/install.sh}
AGY_BIN="$HOME/.local/bin"
AGY_SETTINGS="$HOME/.gemini/antigravity-cli/settings.json"
# The workshop's model, as agy's own /model menu saves it: Flash, low effort,
# so a free account's weekly quota lasts the whole workshop.
AGY_MODEL="Gemini 3.8 Flash (Low)"
QUOTA_MIN=60

# Antigravity's own installer puts agy in ~/.local/bin. It adds that folder
# only to start-up files that are already there, and a new Mac has none, so
# this script adds it for new terminals as well; this window finds it too.
use_agy_bin() {
  add_to_new_terminals .local/bin
  PATH="$AGY_BIN:$PATH"
  export PATH
}

ensure_agy() {
  if ! have agy && [ -x "$AGY_BIN/agy" ]; then use_agy_bin; fi
  if have agy; then
    ok "The Antigravity CLI is installed (agy $(agy --version 2>/dev/null))."
    return 0
  fi
  info "Installing the Antigravity CLI..."
  # Antigravity's installer is written for bash, which macOS and Linux have.
  if fetch "$AGY_INSTALLER" "$WORK/agy-install.sh" && bash "$WORK/agy-install.sh" </dev/null >"$WORK/agy-install.log" 2>&1 && [ -x "$AGY_BIN/agy" ]; then
    use_agy_bin
    ok "Installed the Antigravity CLI (agy $(agy --version 2>/dev/null))."
    return 0
  fi
  if [ -s "$WORK/agy-install.log" ]; then info "(agy installer: $(tail -n 1 "$WORK/agy-install.log"))"; fi
  todo "The Antigravity CLI could not be installed." \
    "Check your internet connection, then run this command again."
}

# Auto mode and the workshop's model, written into agy's settings, and the repo
# folder added to the trusted folders, so agy starts there without asking.
# Every other setting stays as it is; a file that is not JSON is left alone.
set_up_agy() {
  have agy && node_is_new_enough node || return 0
  trust=""
  if [ -d "$REPO_DIR" ]; then trust=$REPO_DIR; fi
  if AGY_SETTINGS="$AGY_SETTINGS" AGY_MODEL="$AGY_MODEL" AGY_TRUST="$trust" node -e '
    const fs = require("fs"), path = require("path");
    const file = process.env.AGY_SETTINGS;
    let settings = {};
    if (fs.existsSync(file)) {
      try { settings = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); } catch { process.exit(1); }
      if (settings === null || typeof settings !== "object" || Array.isArray(settings)) process.exit(1);
    }
    const workshop = { agentMode: "auto", model: process.env.AGY_MODEL };
    const trusted = Array.isArray(settings.trustedWorkspaces) ? settings.trustedWorkspaces : [];
    const trust = process.env.AGY_TRUST;
    if (trust) workshop.trustedWorkspaces = trusted.includes(trust) ? trusted : [...trusted, trust];
    if (JSON.stringify({ ...settings, ...workshop }) === JSON.stringify(settings)) process.exit(0);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...settings, ...workshop }, null, 2) + "\n");
  ' 2>/dev/null; then
    ok "The Antigravity CLI starts in auto mode, with Gemini 3.8 Flash, the workshop's model."
  else
    info "The settings of the Antigravity CLI could not be read, so they stay as they are: $AGY_SETTINGS"
    info "In the Antigravity CLI, press Shift+Tab until it shows auto, and pick Gemini 3.8 Flash with /model."
  fi
}

# Asks agy for the quota left, which costs none of it. Not signed in, agy asks
# for the sign-in at once and then waits for it; that is not waited for.
read_quota() {
  ( cd "$WORK" && exec agy -p /usage --output-format json ) </dev/null >"$WORK/usage.json" 2>&1 &
  pid=$!
  waited=0
  while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 30 ]; do
    if grep -q "Authentication required" "$WORK/usage.json" 2>/dev/null; then break; fi
    sleep 1
    waited=$((waited + 1))
  done
  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  if grep -q "Authentication required" "$WORK/usage.json" 2>/dev/null; then echo signed-out; return 0; fi
  node -e '
    const usage = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const gemini = usage.command.data.groups.find((group) => /^Gemini/.test(group.name));
    const weekly = gemini.buckets.find((bucket) => bucket.window === "weekly");
    console.log(Math.floor(weekly.remaining_fraction * 100));
  ' "$WORK/usage.json" 2>/dev/null
}

# The workshop uses up to 30% of a free account's weekly Gemini quota. Below
# twice that, the participant hears it now, not in the middle of the Developer.
check_quota() {
  have agy && node_is_new_enough node || return 0
  left=$(read_quota)
  case $left in
    signed-out)
      info "When the Antigravity CLI starts, it asks you to sign in with your Google account, in the browser."
      ;;
    '' | *[!0-9]*)
      info "Your Gemini quota could not be read. That is fine: the workshop works without this check."
      ;;
    *)
      if [ "$left" -ge "$QUOTA_MIN" ]; then
        ok "Your Google account has $left% of this week's Gemini quota left."
      else
        info "Your Google account has $left% of this week's Gemini quota left, and the workshop can use up to 30%."
        info "It may run out before the end. To be safe, sign in with another Google account: in the Antigravity CLI, type /logout."
      fi
      ;;
  esac
}

# -------------------------------------------------------------------- repo

looks_like_the_template() {
  [ -f "$1/tools/check.mjs" ] || [ -f "$1/site/content.json" ]
}

# The finished copy replaces the repo folder only if that folder is missing or
# empty, so a half-finished run never ends up inside an existing folder.
move_into_place() {
  rmdir "$REPO_DIR" 2>/dev/null
  if [ -e "$REPO_DIR" ]; then return 1; fi
  mv "$REPO_DIR.partial" "$REPO_DIR"
}

clone_repo() {
  rm -rf "$REPO_DIR.partial"
  GIT_TERMINAL_PROMPT=0 git clone -q "$REPO_URL.git" "$REPO_DIR.partial" || return 1
  move_into_place
}

# A folder downloaded while Git was missing gets Git's history added; the
# files in it, including any changes, stay as they are.
connect_download_to_git() {
  rm -rf "$REPO_DIR.partial"
  GIT_TERMINAL_PROMPT=0 git clone -q --no-checkout "$REPO_URL.git" "$REPO_DIR.partial" || return 1
  mv "$REPO_DIR.partial/.git" "$REPO_DIR/.git" || return 1
  rm -rf "$REPO_DIR.partial"
  git -C "$REPO_DIR" reset -q
}

download_repo() {
  fetch "$REPO_URL/archive/HEAD.tar.gz" "$WORK/repo.tar.gz" || return 1
  rm -rf "$REPO_DIR.partial"
  mkdir "$REPO_DIR.partial"
  tar -xzf "$WORK/repo.tar.gz" -C "$REPO_DIR.partial" --strip-components=1 || return 1
  move_into_place
}

get_repo() {
  if [ -d "$REPO_DIR/.git" ]; then
    ok "Your repo is already in $REPO_DIR."
    return 0
  fi
  if [ -d "$REPO_DIR" ] && [ -n "$(ls -A "$REPO_DIR")" ]; then
    if ! looks_like_the_template "$REPO_DIR"; then
      todo "There is already a folder $REPO_DIR, and it is not your portfolio repo." \
        "Rename or move that folder, then run this command again."
      return 1
    fi
    if [ "$HAVE_GIT" = 0 ]; then
      ok "Your repo is already in $REPO_DIR (downloaded without Git)."
      return 0
    fi
    if connect_download_to_git; then
      ok "Connected your repo folder to Git: $REPO_DIR"
      return 0
    fi
    todo "Your repo folder could not be connected to Git yet." \
      "Check your internet connection, then run this command again."
    return 1
  fi
  if ! page_exists "$REPO_URL"; then
    todo "I could not find your repo at $REPO_URL." \
      "Check your username, and that you created your copy from the template, named it \"$REPO\" and made it Public. Then run this command again."
    return 1
  fi
  if [ "$HAVE_GIT" = 1 ]; then
    if clone_repo; then
      ok "Copied your repo to $REPO_DIR."
      return 0
    fi
    info "Git could not copy your repo; downloading it instead."
  fi
  if download_repo; then
    ok "Downloaded your repo to $REPO_DIR (without Git for now; it gets connected once Git is installed)."
    return 0
  fi
  todo "Your repo could not be downloaded from $REPO_URL." \
    "Check your internet connection, then run this command again."
}

# The last step: the Antigravity CLI, started in the repo folder, takes over
# this window. Only in a terminal, and only when nothing is left to do.
can_start_agent() {
  [ -z "$NEXT" ] && [ -z "${PORTFOLIO_UNATTENDED:-}" ] && have agy && [ -d "$REPO_DIR" ] && [ -t 1 ] && (: </dev/tty) 2>/dev/null
}

start_agent() {
  printf '\nStarting the Antigravity CLI in your repo folder.\n\n'
  cd "$REPO_DIR" || exit 1
  rm -rf "$WORK"
  trap - EXIT
  exec agy </dev/tty
}

# ---------------------------------------------------------------- workshop

# A text as a JSON string, in double quotes. A backslash or a double quote
# gets a backslash in front, a line break and the other control characters
# are written as \n and \u0001 to \u001f, and everything else, such as an
# apostrophe or an accent, stays as it is. One character at a time, so no
# awk has to agree on backslashes in a replacement.
json_string() {
  printf '%s\n' "$1" | awk '
    BEGIN {
      for (i = 1; i < 32; i++) escaped[sprintf("%c", i)] = sprintf("\\u%04x", i)
      escaped["\\"] = "\\\\"
      escaped["\""] = "\\\""
      printf "%s", "\""
    }
    NR > 1 { printf "%s", "\\n" }
    {
      for (i = 1; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (c in escaped) c = escaped[c]
        printf "%s", c
      }
    }
    END { printf "%s", "\"" }'
}

# The content of workshop.json: the event, and its date, city, start and end
# if the line names them. The start and end (HH:MM) let the Role clock follow
# the room (tools/clock.mjs).
workshop_json() {
  printf '{\n  "event": %s' "$(json_string "$WORKSHOP_EVENT")"
  if [ -n "${WORKSHOP_DATE:-}" ]; then printf ',\n  "date": %s' "$(json_string "$WORKSHOP_DATE")"; fi
  if [ -n "${WORKSHOP_CITY:-}" ]; then printf ',\n  "city": %s' "$(json_string "$WORKSHOP_CITY")"; fi
  if [ -n "${WORKSHOP_START:-}" ]; then printf ',\n  "start": %s' "$(json_string "$WORKSHOP_START")"; fi
  if [ -n "${WORKSHOP_END:-}" ]; then printf ',\n  "end": %s' "$(json_string "$WORKSHOP_END")"; fi
  printf '\n}\n'
}

# The event this laptop is set up for, as the guide's line names it, saved in
# workshop.json in the repo: the Analyst adds it to the site. Written again on
# every run; without WORKSHOP_EVENT, nothing is written.
write_workshop() {
  if [ -z "${WORKSHOP_EVENT:-}" ] || ! looks_like_the_template "$REPO_DIR"; then return 0; fi
  if workshop_json 2>/dev/null >"$REPO_DIR/workshop.json"; then
    ok "Saved your workshop in workshop.json: $WORKSHOP_EVENT."
  else
    info "Your workshop could not be saved in workshop.json. That is fine: the Analyst works without it."
  fi
}

# -------------------------------------------------------------------- main

printf 'Setting up your laptop for the portfolio workshop.\n'

if [ "$OS" = other ]; then
  printf 'This script is for macOS and Linux. On Windows, use the PowerShell line from the guide.\n'
  exit 1
fi

heading "Apps"
check_chrome

heading "GitHub"
set_up_github

heading "Tools"
ensure_git
ensure_node
prepare_devtools

heading "Your repo"
get_repo
write_workshop
set_up_git_for_github

heading "Antigravity CLI"
ensure_agy
set_up_agy
check_quota

heading "Summary"
if [ -z "$NEXT" ]; then
  printf 'Everything is ready.\n'
else
  printf 'Still to do:\n'
  printf '%s' "$NEXT" | awk '{ print "  " NR ". " $0 }'
fi
printf 'Run this command again any time; it only does what is still missing.\n'
if can_start_agent; then
  printf 'To come back later, open a new terminal window and type: cd %s, then agy\n' "$REPO"
  start_agent
fi
if [ "$NEW_TERMINAL" = 1 ]; then
  printf 'New programs were added: close this window and open a new terminal window before you continue.\n'
fi
printf 'To start the workshop, type: cd %s, then agy\n' "$REPO"
