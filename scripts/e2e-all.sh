#!/bin/sh

set -eu

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

pnpm --filter @influenca/cli... run build

apps/cli/dist/bin.js accession fixtures --outDir "tmp/$TIMESTAMP" --no-timestamp

apps/cli/dist/bin.js analyze "tmp/$TIMESTAMP" --no-minimal

cat "tmp/$TIMESTAMP/.influenca.json"

jq -r '"\nFixtures: \(length) items"' "tmp/$TIMESTAMP/.influenca.json"
# Outputs: The active ESLint version is: ^9.0.0


printf "\033[32mHello \033[1;35mPurple\033[0m\n"
