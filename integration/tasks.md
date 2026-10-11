# Operational tasks

Run `mise tasks --local` to list the task entrypoints. Shell entrypoints live in
`mise-tasks/`; their directory names become colon-separated task names, without
an extra declaration in `mise.toml`.

| Task | Purpose |
| ---- | ------- |
| `build:native <tool> <source> <output>` | Build a native guest for formicarium |
| `site:build [output]` | Assemble the site; defaults to `.site` and formicarium |
| `terrarium:prepare [input options]` | Verify fixed inputs and fetch the pinned npm package |
| `ci:terrarium` | Install, type-check, unit-test and build the package |
| `ci:e2e` | Resolve latest stable guests and test the terminal in three browsers |

The source archive remains pinned by `integration/formicarium-source-inputs.json`.
Preparation verifies that archive, replaces its legacy runtime with the exact
npm package, and verifies the resulting files against
`integration/formicarium-inputs.json`. No legacy runtime is installed.
The `publishedRc` field and `*:rc:*` helper names are retained for compatibility;
they identify the pinned registry package, including stable releases.

For local CI tasks, set `FORMICARIUM_INPUTS_DIR` to the fixed-input bundle.
`ci:e2e` resolves every registered tool's latest stable release and exact commit
on each invocation, acquires its official static binary or builds unmodified
source, assembles the candidate and verifies versions in Node and all three
browsers. Native source builds need Linux x86-64, musl-tools, make, CMake and Perl.
On another host, set `TERRARIUM_GUEST_SITE` to an extracted `latest-guests` CI
artifact. Its defaults and source commits must match the newly resolved releases;
stale artifacts fail instead of falling back. Assembly also verifies their asset
digests and provenance. Preparation verifies fixed inputs and the npm package before
the frozen dependency installation.

PR CI uses the same latest guest pipeline. Its `E2E (chromium)`,
`E2E (firefox)` and `E2E (webkit)` checks cover latest versions, terminal controls,
persistence and iframe/origin contracts. The former Emscripten E2E workflow and
old aube `v2.6.1` download and manual Emscripten builds have been removed.
Pages manual source refs use the same native builder and acceptance pipeline.
See [registered source refs](latest-tool-builds.md#registered-source-refs-and-vivarium-comparison)
for branch, commit, PR and fork registration.

Simple commands and task dependencies remain in `mise.toml`. Shared, tested
JavaScript logic stays in `scripts/`; source ref resolution, native acquisition
and candidate assembly are used by both local commands and GitHub Actions.

GitHub Actions owns matrices, artifact transfer, permissions and deployment.
It can invoke these same task files directly after setting up its tools. This
keeps local operations reproducible without adding wrapper scripts for CI.
The legacy browser harness, manual build/staging tasks, vendoring helpers,
Emscripten runtime additions and patches have been retired. The published
`Session` API remains available for existing package consumers; Pages uses
formicarium exclusively.

The unused `check-pitchfork-runtime.mjs` checker, tied to `v2.29.0`, has been
removed. The maintained Playwright suites cover CLI commands, disk persistence,
tool switching, custom elements and iframe integration.
