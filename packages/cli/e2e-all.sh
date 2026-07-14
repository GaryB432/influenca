#!/bin/sh

set -eu

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

pnpm --filter @influenca/cli... run build

packages/cli/dist/bin.mjs ascession fixtures/a --output "tmp/$TIMESTAMP"

packages/cli/dist/bin.mjs analyze "tmp/$TIMESTAMP"

printf "\033[32mHello \033[1;35mWorld\033[0m\n"


