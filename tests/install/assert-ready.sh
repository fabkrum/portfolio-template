#!/usr/bin/env bash
# Asserts what a participant has after the Install script, as seen from a fresh
# terminal: a new shell that knows only what the shell start-up files tell it.
#
# Usage: bash tests/install/assert-ready.sh <repo-folder> <origin-url> [--without-git]
#   --without-git  the repo was downloaded because Git was missing: expect the
#                  files, but no Git connection yet.
# WORKSHOP_EVENT, WORKSHOP_DATE and WORKSHOP_CITY, as the guide's line sets
# them: expect them in workshop.json in the repo. Without WORKSHOP_EVENT,
# expect no workshop.json.
set -u

repo_dir=$1
origin=$2
without_git=${3:-}

case "$(uname -s)" in
  Darwin) fresh_shell=(zsh -lic) ;; # Terminal.app opens a login zsh
  *) fresh_shell=(bash -ic) ;;      # Linux desktop terminals open an interactive bash
esac

in_fresh_terminal() {
  env -i HOME="$HOME" USER="${USER:-runner}" TERM=dumb PATH=/usr/bin:/bin:/usr/sbin:/sbin \
    "${fresh_shell[@]}" "$1" 2>/dev/null
}

failures=0
pass() { echo "ok:   $*"; }
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

node_version=$(in_fresh_terminal 'node --version')
node_major=$(printf '%s' "$node_version" | sed -n 's/^v\([0-9][0-9]*\)\..*/\1/p')
if [ -n "$node_major" ] && [ "$node_major" -ge 22 ]; then
  pass "Node $node_version in a fresh terminal"
else
  fail "Node 22 or newer in a fresh terminal (got '${node_version:-nothing}')"
fi

if [ -f "$repo_dir/tools/check.mjs" ] && [ -f "$repo_dir/site/content.json" ]; then
  pass "repo files in $repo_dir"
else
  fail "repo files in $repo_dir"
fi

if [ "$without_git" = "--without-git" ]; then
  if [ -d "$repo_dir/.git" ]; then fail "no Git connection yet"; else pass "downloaded without Git"; fi
else
  git_version=$(in_fresh_terminal 'git --version')
  # Ubuntu answers an unknown command with advice, so match the real output.
  if printf '%s' "$git_version" | grep -q '^git version'; then pass "$git_version in a fresh terminal"; else fail "Git in a fresh terminal"; fi
  actual_origin=$(git -C "$repo_dir" remote get-url origin 2>/dev/null)
  if [ "$actual_origin" = "$origin" ]; then pass "origin is $origin"; else fail "origin is $origin (got '$actual_origin')"; fi
  # workshop.json is the Install script's own file, checked below. A repo made
  # from an older template does not ignore it yet.
  changes=$(git -C "$repo_dir" status --porcelain -- . ':!workshop.json' 2>&1)
  if [ -z "$changes" ]; then pass "working tree matches the repo"; else fail "working tree matches the repo: $changes"; fi
fi

# The Node of a fresh terminal reads workshop.json; the variables reach it
# from this shell.
node_path=$(in_fresh_terminal 'command -v node')
if workshop=$("${node_path:-node}" "$(dirname "$0")/workshop-json.mjs" "$repo_dir" 2>&1); then pass "$workshop"; else fail "$workshop"; fi

# Antigravity IDE starts Chrome DevTools for agents with npx, the version in
# .agents/mcp_config.json. The Install script put it in the npm cache, so it
# starts from there without the network.
devtools=$(sed -n 's/.*"\(chrome-devtools-mcp@[^"]*\)".*/\1/p' "$(dirname "$0")/../../.agents/mcp_config.json")
devtools_version=$(in_fresh_terminal "npx --offline -y $devtools --version" | tail -n 1)
if [ -n "$devtools" ] && [ "$devtools_version" = "${devtools#chrome-devtools-mcp@}" ]; then
  pass "Chrome DevTools for agents $devtools_version starts from the npm cache, offline, in a fresh terminal"
else
  fail "Chrome DevTools for agents (${devtools:-not in the config}) starts from the npm cache, offline (got '${devtools_version:-nothing}')"
fi

check_output=$(cd "$repo_dir" && in_fresh_terminal 'node tools/check.mjs')
if printf '%s' "$check_output" | grep -q 'items pass'; then
  pass "the Check runs in the repo"
else
  fail "the Check runs in the repo. Output:"
  printf '%s\n' "$check_output"
fi

exit $((failures > 0))
