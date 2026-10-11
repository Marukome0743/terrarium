# Operational tasks

Run `mise tasks --local` to list the task entrypoints. Shell entrypoints live in
`mise-tasks/`; their directory names become colon-separated task names, without
an extra declaration in `mise.toml`.

| Task | Purpose |
| ---- | ------- |
| `build:resolve <tool> <ref>` | Resolve a branch, release, commit or PR to a source identity |
| `build:aube <source> <output>` | Build the legacy Emscripten aube guest |
| `build:pitchfork <source> <output>` | Build the legacy Emscripten pitchfork guest |
| `build:native <tool> <source> <output>` | Build a native guest for formicarium |
| `build:fetch <ref>...` | Fetch published legacy aube builds |
| `build:load` | Load the published builds branch |
| `web:stage [tool ref output]` | Stage guest files and build metadata |
| `site:build [output] [mode]` | Assemble the site; defaults to `.site` and formicarium |
| `terrarium:prepare [input options]` | Verify fixed inputs and fetch the pinned npm RC |
| `ci:terrarium` | Install, type-check, unit-test and build the package |
| `ci:pitchfork-prepare` | Verify and stage the selected legacy pitchfork build |
| `ci:e2e` | Resolve latest stable guests and test the terminal in three browsers |

For local CI tasks, set `FORMICARIUM_INPUTS_DIR` to the fixed-input bundle.
`ci:e2e` resolves every registered tool's latest stable release and exact commit
on each invocation, acquires its official static binary or builds unmodified
source, assembles the candidate and verifies versions in Node and all three
browsers. Native source builds need Linux x86-64, musl-tools, make, CMake and Perl.
On another host, set `TERRARIUM_GUEST_SITE` to an extracted `latest-guests` CI
artifact. Its defaults and source commits must match the newly resolved releases;
stale artifacts fail instead of falling back. Assembly also verifies their asset
digests and provenance. Preparation verifies fixed inputs and the npm RC before
the frozen dependency installation.

PR CI uses the same latest guest pipeline. Its `E2E (chromium)`,
`E2E (firefox)` and `E2E (webkit)` checks cover latest versions, terminal controls,
persistence and iframe/origin contracts. The former Emscripten E2E workflow and
old aube `v2.6.1` download are no longer part of routine acceptance. Legacy build
entrypoints remain available for explicit manual builds.

Simple commands and task dependencies remain in `mise.toml`. Shared, tested
JavaScript logic stays in `scripts/`, as do shared shell build helpers such as
`emscripten-env.sh`, `patch-rust-src.sh` and `vendor-patched.sh`. These are
implementation details rather than additional task entrypoints.

GitHub Actions owns matrices, artifact transfer, permissions and deployment.
It can invoke these same task files directly after setting up its tools. This
keeps local operations reproducible without adding wrapper scripts for CI.
The historical legacy browser suites remain available for explicit investigation.

The unused `check-pitchfork-runtime.mjs` checker, tied to `v2.29.0`, has been
removed. The maintained Playwright suites cover CLI commands, disk persistence,
tool switching, custom elements and iframe integration. Historical AI-DLC
records still describe the old acceptance run.
