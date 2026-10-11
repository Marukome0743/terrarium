---
title: Maintenance
description: Development, validation, deployment and integration procedures.
---

Use GitHub Issues to describe work, a short design note for changes that need one,
and pull requests with CI to review changes. Repository rules live in
[AGENTS.md](https://github.com/aletheia-works/terrarium/blob/main/AGENTS.md).
Completed workflow records and generated lifecycle tooling are not required.

## Local validation

Tools are pinned in `mise.toml`; use `mise exec -- <command>` and `mise run`.
Shell entrypoints live in `mise-tasks/` and are discovered automatically. Shared
JavaScript logic stays in `scripts/`, used by local tasks and GitHub Actions.
Bun is the package manager. Keep the public package's lockfile at format version
1, which Dependabot understands.

Set `FORMICARIUM_INPUTS_DIR` to the verified fixed-input bundle. Preparation also
fetches the exact npm RC tarball and validates its integrity before installing
frozen dependencies. The fixed runtime and latest guest selection have separate
identities: a fixed acceptance catalogue cannot silently replace latest guests.

```sh
mise run terrarium:rc:prepare
mise run ci:terrarium
mise run lint:all
mise run ci:e2e
```

`ci:terrarium` runs type-check, unit tests and package build. `ci:e2e` resolves
latest stable guests and runs Node plus Chromium, Firefox and WebKit acceptance,
including CLI output, persistence, terminal controls, element/iframe contracts
and the header-free Pages demo. Run matching checks before pushing a change.

Native compilation needs Linux x86-64, musl-tools, make, CMake and Perl. On macOS,
`TERRARIUM_GUEST_SITE` can select an extracted CI guest artifact. Its resolved
tags and full commits must match the current latest releases; stale inputs fail
rather than falling back. See the repository's
[task instructions](https://github.com/aletheia-works/terrarium/blob/main/integration/tasks.md)
and [guest build procedures](https://github.com/aletheia-works/terrarium/blob/main/integration/latest-tool-builds.md)
for explicit environment variables and commands.

## Site and documentation

`docs/` uses Astro and Starlight. Keep user documentation in `src/content/docs/`
and demo routes in `src/pages/demos/`. `site:build` assembles documentation,
search, the terminal bundle, fixtures and validated guests as one candidate.
Avoid importing the browser-only terminal into Astro's server-side build.

`/terrarium/` opens documentation; `/terrarium/web/` is the console and iframe
entry; `/terrarium/demos/` lists CLI cards; `/terrarium/demos/<tool>/` opens a dedicated console.
The list and console routes are generated from `web/tools.json`. Preserve query/ref and
session parameters. See [Demos](/terrarium/demos/) and [Embedding](/terrarium/guides/embedding/).
Keep one Pages deployment workflow for the complete site.

Both project packages use TypeScript 7. The Astro checker currently uses a
separate private TypeScript 6 tooling package because its JavaScript compiler
API is required. Keep both checks until Astro's content mapper supports a stable
TypeScript 7.1 or later integration. See `docs/README.md` for the checker layout.

## CI and Pages

`build-latest-guests.yml` resolves source identities once, builds latest and
registered refs in separate jobs, and transfers same-run artifacts to assembly
and acceptance. It runs on PRs and is reusable by Pages. The required aggregate
check is `guests`; individual E2E jobs run in Chromium, Firefox and WebKit.

Pages resolves latest stable guests on daily, relevant-main-push and manual
runs. All Node and browser checks must pass before deployment. Keep outputs in
Actions artifacts, outside `main` and the retired `builds` branch. A failed run
leaves the previous deployment available.

Pin actions to full commit SHAs, use mise-managed tools, and give each job the
minimum permissions. Jobs that write or use secrets must check the repository
owner. Use `persist-credentials: false` when checkout does not need to push.
Labels and required checks are managed by OpenTofu in `infra/github/`; path
labels come from `.github/labeler.yml`.

## Releases

Release Please prepares a shared version in `packages/terrarium/package.json`,
`packages/terrarium/jsr.json` and its manifest. The publication validator checks
both package versions against the `v<version>` tag. No root version file or root
package is needed. npm and JSR use OIDC trusted publishing with provenance.
Follow the [release guide](/terrarium/guides/releases/) for setup, weekly merges and retries.

An existing release PR can stay stale when Release Please generates the same PR
body, even after main deletes a file that the old branch changes. If this causes
a conflict, ensure there are no merged pending release PRs to publish, append a
temporary explanatory HTML comment to the existing PR body, and dispatch
`release.yml` on main. The Bot then regenerates the branch and restores its
canonical body. Check its parent commit, changed files, mergeability and all CI
checks. Obtain publication authorization if the dispatch can create a release.

Do not rewrite main or released tags, publish without the required human
approval, inline secrets, or perform destructive OpenTofu operations.

## Vivarium integration

Terrarium exposes a single selected build through its element and iframe APIs.
Vivarium owns the layout comparing baseline and fix, explanatory text and shared
sessions. Register exact source refs in terrarium, confirm their provenance and
browser behavior, then use their selection names in Vivarium's embedding URLs.
Keep origin approval and session reset semantics when updating this boundary.
