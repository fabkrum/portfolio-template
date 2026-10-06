#!/bin/sh
# The Install script for macOS and Linux. Paste one line into the Terminal:
#
#   macOS:  curl -fsSL https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.sh | sh
#   Linux:  wget -qO- https://raw.githubusercontent.com/fabkrum/portfolio-template/main/install.sh | sh
#
# It checks Google Chrome and Antigravity IDE, installs Git and Node where they
# are missing, downloads Chrome DevTools for agents for the QA role, puts your
# own portfolio repo in your home folder and opens it in Antigravity IDE. It is
# safe to run again at any time.
#
# It asks for your GitHub username. PORTFOLIO_GITHUB_USER and PORTFOLIO_REPO
# answer that up front (the automated tests use them).

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
  case $REPO in
    '' | . | .. | *[!A-Za-z0-9._-]*) return 1 ;;
  esac
  REPO_DIR="$HOME/$REPO"
  REPO_URL="https://github.com/$GH_USER/$REPO"
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

IDE_APP=""
check_ide() {
  if [ "$OS" = darwin ]; then
    for app in "/Applications/Antigravity IDE.app" "$HOME/Applications/Antigravity IDE.app"; do
      if [ -d "$app" ]; then IDE_APP=$app; fi
    done
  elif have antigravity-ide; then
    IDE_APP=antigravity-ide
  fi
  if [ -n "$IDE_APP" ]; then
    ok "Antigravity IDE is installed."
    return 0
  fi
  if [ -d "/Applications/Antigravity.app" ] || [ -d "$HOME/Applications/Antigravity.app" ]; then
    info "You have Antigravity 2.0, the agent dashboard. Today you need the editor, Antigravity IDE."
  fi
  todo "Antigravity IDE is not installed." \
    "Download \"Antigravity IDE\" (not \"Antigravity 2.0\") from https://antigravity.google/download and install it, then run this command again."
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

# New terminals find our Node first. Each start-up file gets one line, once.
add_node_to_new_terminals() {
  # shellcheck disable=SC2016 # $HOME and $PATH are meant for the start-up file
  line='export PATH="$HOME/.local/node/bin:$PATH" '"$MARK"
  for file in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.bash_profile"; do
    # A new ~/.bash_profile would stop bash from reading ~/.profile.
    if [ "$file" = "$HOME/.bash_profile" ] && [ ! -f "$file" ]; then continue; fi
    if ! grep -qF "$MARK" "$file" 2>/dev/null; then
      printf '\n%s\n' "$line" >>"$file"
    fi
  done
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
  add_node_to_new_terminals
  PATH="$NODE_HOME/bin:$PATH"
  export PATH
  case ":$STARTING_PATH:" in
    *":$NODE_HOME/bin:"*) ;;
    *) NEW_TERMINAL=1 ;;
  esac
  ok "Node is installed ($(node --version))."
}

# ---------------------------------------------- Chrome DevTools for agents

# The version .agents/mcp_config.json starts; tests/devtools.test.js keeps the
# two the same.
DEVTOOLS=chrome-devtools-mcp@1.10.1

# Runs a command for at most $1 seconds, with nothing to read and its output
# thrown away. Fails if the command fails or has to be stopped. The watchdog
# ends by itself once the command is gone, and the 2>/dev/null on wait keeps
# the shell from printing "Terminated" when the time runs out.
run_at_most() {
  seconds=$1
  shift
  "$@" </dev/null >/dev/null 2>&1 &
  pid=$!
  (
    waited=0
    while kill -0 "$pid" 2>/dev/null; do
      if [ "$waited" -ge "$seconds" ]; then
        kill "$pid"
        break
      fi
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

# Antigravity IDE starts Chrome DevTools for agents with npx, from the npm
# cache. Putting it there now means nothing is downloaded during the QA block.
# The download runs on its own first, so stopping it half-way leaves nothing
# broken behind; then one start from the cache alone, offline, shows that it
# runs on this laptop. QA works without it, so this never stops the script.
prepare_devtools() {
  node_is_new_enough node || return 0
  info "Getting Chrome DevTools for agents ready for the QA role..."
  if have npx && run_at_most 120 npm cache add "$DEVTOOLS" && run_at_most 60 npx --offline -y "$DEVTOOLS" --version; then
    ok "Chrome DevTools for agents is ready."
  else
    info "Chrome DevTools for agents could not be set up. That is fine: the QA role works without it."
  fi
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

open_in_ide() {
  if [ -z "$IDE_APP" ] || [ ! -d "$REPO_DIR" ]; then return 0; fi
  if [ "$OS" = darwin ]; then
    opened=$(open -a "$IDE_APP" "$REPO_DIR" >/dev/null 2>&1 && echo yes)
  else
    nohup "$IDE_APP" "$REPO_DIR" >/dev/null 2>&1 &
    ok "Opening your repo in Antigravity IDE."
    return 0
  fi
  if [ "$opened" = yes ]; then
    ok "Opened your repo in Antigravity IDE."
  else
    todo "Antigravity IDE did not open by itself." \
      "Open Antigravity IDE, choose File > Open Folder and pick $REPO_DIR."
  fi
}

# -------------------------------------------------------------------- main

printf 'Setting up your laptop for the portfolio workshop.\n'

if [ "$OS" = other ]; then
  printf 'This script is for macOS and Linux. On Windows, use the PowerShell line from the guide.\n'
  exit 1
fi

if ! ask_github_user; then
  printf '\nThat does not look like a GitHub username: "%s".\n' "$GH_USER${REPO:+/$REPO}"
  printf 'Run this command again and type just your username, for example: ada-lovelace\n'
  exit 1
fi

heading "Apps"
check_chrome
check_ide

heading "Tools"
ensure_git
ensure_node
prepare_devtools

heading "Your repo"
get_repo
open_in_ide

heading "Summary"
if [ -z "$NEXT" ]; then
  printf 'Everything is ready.\n'
else
  printf 'Still to do:\n'
  printf '%s' "$NEXT" | awk '{ print "  " NR ". " $0 }'
fi
if [ "$NEW_TERMINAL" = 1 ]; then
  printf 'Node was added for new terminals: close this terminal and open a new terminal window before you continue.\n'
fi
printf 'Run this command again any time; it only does what is still missing.\n'
