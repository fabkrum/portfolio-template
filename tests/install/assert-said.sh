#!/usr/bin/env bash
# Asserts that the Install script told the participant each given message.
# Usage: bash tests/install/assert-said.sh <log-file> <message>...
set -u

log=$1
shift
failures=0
for message in "$@"; do
  if grep -qF -- "$message" "$log"; then
    echo "ok:   said \"$message\""
  else
    echo "FAIL: said \"$message\""
    failures=$((failures + 1))
  fi
done
exit $((failures > 0))
