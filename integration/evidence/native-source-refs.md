# Native source ref acceptance — 2026-10-11

## Build evidence

The generic registered-tool pipeline compiled unmodified sources on Linux CI,
with pinned Rust 1.99.0, target `x86_64-unknown-linux-musl` and no source patches.
[Acceptance run](https://github.com/aletheia-works/terrarium/actions/runs/38115477404)
contains temporary aube and pitchfork source selections in addition to the
configured Biome comparison. These acceptance-only selections are removed from
`web/tool-refs.json` before submission; latest stable defaults stay unchanged.

| Tool | Requested ref | Resolved commit | Built ELF SHA256 |
| ---- | ------------- | --------------- | ---------------- |
| aube | `d36fec01764689ef6d99a5e43de98925b571d67f` | `d36fec01764689ef6d99a5e43de98925b571d67f` | `5ab55d0f8adbe25c7779fa0da604d71a7a638a333e39b354d89e96756636b317` |
| pitchfork | `v2.30.1` | `1054549e85470b08d9507e2c82c850959a4b3914` | `aa6eacb17ca958db45503fb4e959fb051838fb9f40a47bcf5e809790ffb2687d` |

Pitchfork's UI was built with official aube and Node 24.21.0. Its index SHA256
was `28b532667fdc84da92b50b8eeeacc06ec64e8bac64de3b3f1547dd3dd76ec911`.
The guest metadata records `git-unmodified`, exact source URL/ref/commit,
`sourcePatches: []`, static linkage and musl libc.

## Local execution

Host: macOS, Node 26.11.1, Bun 1.4.3, Playwright 1.63.0.

In the isolated `/private/tmp/terrarium-native-refs` workspace, downloaded the
same-run `latest-base`, `native-resolutions`, and the two source build artifacts:

```sh
gh run download 38115477404 --repo aletheia-works/terrarium --name latest-base --dir .vendor/acceptance-base
gh run download 38115477404 --repo aletheia-works/terrarium --name native-resolutions --dir .vendor/acceptance-resolutions
gh run download 38115477404 --repo aletheia-works/terrarium --name tool-ref-aube-acceptance-aube-source --dir .vendor/acceptance-builds/aube
gh run download 38115477404 --repo aletheia-works/terrarium --name tool-ref-pitchfork-acceptance-pitchfork-source --dir .vendor/acceptance-builds/pitchfork
```

Filtered that run's resolutions to aube/pitchfork, called `stageToolRef` for each
artifact, then assembled and executed the verified catalogue:

```sh
TERRARIUM_GUEST_SITE=.vendor/acceptance-base mise run site:build .vendor/acceptance-site
mise exec -- node scripts/check-tool-refs.mjs .vendor/acceptance-site
cd packages/terrarium
TERRARIUM_BUN=$(mise which bun) TERRARIUM_SITE_DIR=/private/tmp/terrarium-native-refs/.vendor/acceptance-site mise exec -- bun x playwright test --config playwright.latest.config.ts
```

Node reported aube `2.7.0 linux-x64 (2026-10-11)` and pitchfork `2.30.1` with
matching resolved source identities. Playwright passed **63/63**, **21 per
Chromium, Firefox and WebKit**, no skips, in 2.9 minutes. This includes latest
stable versions, both source selections with default/explicit fixtures, terminal
controls, persistence, tool switching and iframe/origin contracts.

## Cleanup and compatibility

Removed the obsolete manual Emscripten build/resolve/load/staging tasks, three
vendoring/toolchain helpers, 18 crate/tool/toolchain patches, three runtime
supplements and their retired helper/workflow tests. Candidate assembly only
accepts formicarium. Its rollback and symlink protections remain tested, including
rejecting a symlinked `web` parent before staging can write outside the candidate.

Published `Session`/`Tool` exports remain for existing package consumers. The
legacy shared `builds` branch is no longer consumed;
Pages no longer reads or writes that branch.

The shared resolver tests cover branches, full commits and PR heads for all three
tools against arbitrary fork names, plus a newly registered Cargo CLI with a
repository name unrelated to its tool name. Registration tests cover metadata
immutability, latest-default preservation and source identity mismatch rejection.
Future tools need registry builder metadata, fixtures and execution compatibility;
non-Cargo build systems need a builder adapter.

After removing the retired files, candidate assembly and both Node checkers
passed again. `FORMICARIUM_INPUTS_DIR=<verified-input-directory> mise run
ci:terrarium` passed type-check, **153 tests / 549 assertions**, and package build.
`mise run lint:all` passed; `mise tasks --local` lists the native builder and
no retired build/load/staging entrypoints.

The post-cleanup candidate also passed **63/63** browser cases, **21 per
browser**, no skips, in 2.0 minutes. The same-run CI additionally built the
configured Biome before commit `2405c7620169bd0719166af09a8d89cc76fb37fb`
and after commit `f79f85d58ae499647c127f1e90a4931e3dbbb206`; candidate Node
acceptance verified their existing migration expectations.

CI run `38115477404` completed successfully: **23 cases each** in Chromium
(49.2s), Firefox (54.5s), and WebKit (59.8s), **69/69 total**, with no skips.
These include all four source selections (aube, pitchfork, both Biome comparisons),
latest stable guests and existing terminal/iframe contracts. The required
`guests` aggregate also passed.
