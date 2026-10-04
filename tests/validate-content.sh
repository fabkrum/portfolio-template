#!/usr/bin/env bash
# The sample content file and the content files the Analyst skill wrote in
# its proxy runs must validate against the schema, and every fixture in
# tests/fixtures/invalid-content must be rejected.
# Needs check-jsonschema on PATH (pip install check-jsonschema).
set -u
cd "$(dirname "$0")/.."

failed=0

if check-jsonschema --schemafile site/content.schema.json site/content.json; then
  echo "ok: site/content.json is valid"
else
  echo "FAIL: site/content.json does not match the schema"
  failed=1
fi

for written in tests/fixtures/analyst-runs/*/site/content.json; do
  if check-jsonschema --schemafile site/content.schema.json "$written" > /dev/null 2>&1; then
    echo "ok: $written is valid"
  else
    echo "FAIL: $written does not match the schema"
    failed=1
  fi
done

for fixture in tests/fixtures/invalid-content/*.json; do
  if check-jsonschema --schemafile site/content.schema.json "$fixture" > /dev/null 2>&1; then
    echo "FAIL: $fixture was accepted but must be rejected"
    failed=1
  else
    echo "ok: $fixture is rejected"
  fi
done

exit "$failed"
