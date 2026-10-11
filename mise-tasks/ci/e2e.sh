#!/usr/bin/env bash
#MISE description="Test latest stable formicarium guests in all browsers"
set -euo pipefail
bash mise-tasks/terrarium/prepare.sh
(cd packages/terrarium && bun install --frozen-lockfile)
mkdir -p .vendor/native
node scripts/latest-guests.mjs resolve .vendor/native/resolutions.json
if [[ -z ${TERRARIUM_GUEST_SITE:-} ]]; then
  node scripts/latest-guests.mjs build .vendor/native/resolutions.json .vendor/native
  node scripts/latest-guests.mjs stage .vendor/native/resolutions.json .vendor/latest-guests .vendor/formicarium-inputs/resolver
  TERRARIUM_GUEST_SITE="$PWD/.vendor/latest-guests"
fi
export TERRARIUM_GUEST_SITE
node scripts/latest-guests.mjs verify .vendor/native/resolutions.json "$TERRARIUM_GUEST_SITE"
bash mise-tasks/site/build.sh .vendor/site-latest
node scripts/check-latest-guests.mjs .vendor/site-latest
export TERRARIUM_BUN
TERRARIUM_BUN=$(command -v bun)
export TERRARIUM_SITE_DIR="$PWD/.vendor/site-latest"
(cd packages/terrarium && bun run test:e2e -- --workers=1 --retries=0)
