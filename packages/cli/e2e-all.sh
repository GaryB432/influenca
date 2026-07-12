#!/bin/sh

set -eu

pnpm run build
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
packages/cli/dist/bin.mjs ascession fixtures/vidz --output "tmp/$TIMESTAMP"
packages/cli/dist/bin.mjs analyze "tmp/$TIMESTAMP"

