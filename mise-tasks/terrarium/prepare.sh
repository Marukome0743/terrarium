#!/usr/bin/env bash
#MISE description="Verify fixed inputs and acquire the pinned npm package before installation"
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
if [[ $# -eq 0 ]]; then
  set -- --from "${FORMICARIUM_INPUTS_DIR:?Set FORMICARIUM_INPUTS_DIR}"
fi
node "$root/scripts/fetch-formicarium-rc.mjs"
node "$root/scripts/prepare-published-formicarium.mjs" "$@"
