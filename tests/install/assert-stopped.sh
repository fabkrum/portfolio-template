#!/usr/bin/env bash
# Asserts that the Install script stopped at the repo, as it must for a repo
# that is not the participant's copy of the Template: it said nothing about a
# repo set up, and it left the repo folder as it found it.
#
# Usage: bash tests/install/assert-stopped.sh <log-file> <repo-folder> [<commit>]
#   <commit>  the folder was there before the run, at this commit: expect it
#             still there, unchanged, with nothing added (no workshop.json
#             either). Without it, the folder was not there: expect no folder
#             and no partial folder next to it.
set -u

log=$1
repo_dir=$2
commit=${3:-}

failures=0
pass() { echo "ok:   $*"; }
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

# Opening the folder in Antigravity IDE shows as one of the last three, where
# the IDE is installed.
for message in "Copied your repo" "Downloaded your repo" "Connected your repo folder" "Your repo is already in" \
  "Saved your workshop" "Everything is ready." "Opened your repo" "Opening your repo" "Antigravity IDE did not open by itself"; do
  if grep -qF -- "$message" "$log"; then fail "did not say \"$message\""; else pass "did not say \"$message\""; fi
done

if [ -z "$commit" ]; then
  if [ -e "$repo_dir" ]; then fail "no folder $repo_dir"; else pass "no folder $repo_dir"; fi
  if [ -e "$repo_dir.partial" ]; then fail "no folder $repo_dir.partial"; else pass "no folder $repo_dir.partial"; fi
else
  actual=$(git -C "$repo_dir" rev-parse HEAD 2>/dev/null)
  if [ "$actual" = "$commit" ]; then pass "$repo_dir still at $commit"; else fail "$repo_dir still at $commit (got '$actual')"; fi
  # --ignored: a workshop.json the folder's own .gitignore hides counts too.
  changes=$(git -C "$repo_dir" status --porcelain --ignored 2>&1)
  if [ -z "$changes" ]; then pass "nothing changed or added in $repo_dir"; else fail "nothing changed or added in $repo_dir: $changes"; fi
fi

exit $((failures > 0))
