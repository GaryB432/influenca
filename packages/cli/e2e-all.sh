#!/bin/sh

set -eu

# if [ -z "${XDG_RUNTIME_DIR:-}" ]; then
#   echo "XDG_RUNTIME_DIR is required for this e2e test." >&2
#   exit 1
# fi

# runtime_dir=${XDG_RUNTIME_DIR%/}
# if [ -z "$runtime_dir" ]; then
#   runtime_dir=$XDG_RUNTIME_DIR
# fi

# script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# repo_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)

# test_root="$runtime_dir/gb-pm-e2e-$$"
# cleanup() {
#   rm -rf -- "$test_root"
# }
# trap cleanup EXIT INT TERM

# mkdir -p "$test_root"
# cd "$test_root"

pnpm run build
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
packages/cli/dist/bin.mjs ascession fixtures/vidz --output "tmp/$TIMESTAMP"
packages/cli/dist/bin.mjs analyze "tmp/$TIMESTAMP"

