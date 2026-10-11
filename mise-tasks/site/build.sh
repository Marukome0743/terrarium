#!/usr/bin/env bash
#MISE description="Assemble and verify the Pages site (default: .site)"
# usage: mise run site:build <site dir> [formicarium]
# Assemble and verify the entire site before replacing its local candidate.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
node "$root/scripts/assemble-candidate.mjs" "${1:-.site}" "${2:-formicarium}"
