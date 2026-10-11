# AGENTS.md

> Standing instructions for any AI coding agent working in this repository.
> Follows the [agents.md](https://agents.md) convention, as
> [vivarium](https://github.com/aletheia-works/vivarium/blob/main/AGENTS.md)
> does. Read the [architecture](docs/src/content/docs/reference/architecture.md) and
> [maintenance guide](docs/src/content/docs/reference/maintenance.md) for the
> project's decisions and operational entrypoints.

---

## 1. What this project is

**terrarium** runs one CLI tool in the browser, from a terminal, using the pinned formicarium WebAssembly runtime and static x86-64 musl
ELF guests. Registered tools are aube, pitchfork (commands that need no
supervisor), and Biome; see [`web/tools.json`](web/tools.json).

- **A CLI on the web, nothing more.** terrarium makes the CLI usable on a
  page: one terminal running one build. Comparing a build with a fix, and
  explaining a bug, is
  [Vivarium](https://github.com/aletheia-works/vivarium)'s job; Vivarium
  uses terrarium.
- **Several ways in, one implementation.** The `<terrarium-terminal>`
  element in [`packages/terrarium`](packages/terrarium) (published as
  `@aletheia-works/terrarium`) is the terminal; the page at `web/` and the
  iframe entry are built on it.
- Design and maintenance information is in
  [`docs/src/content/docs/reference/`](docs/src/content/docs/reference/), with
  detailed runtime integration procedures in [`integration/`](integration/).

## 2. Non-negotiable guardrails

AI agents **must not** take any of these actions — always hand off to the
human:

- Creating accounts, entering credentials, or handling payments, including
  logging in to npm or JSR.
- Destructive operations on shared state: `tofu destroy`, force-pushing or
  rewriting `main`, deleting released tags or published package versions.
- Rotating, exporting, or committing secrets. Reference them through GitHub
  Actions secrets; never inline.
- Publishing: pushing a `terrarium-v*` or `v*` tag needs the human's
  go-ahead each time.
- **Strategic pivots**: scope, which tools terrarium runs, and architecture
  choices are human decisions.

If unsure whether an action crosses the line, stop and ask.

## 3. Core working principles

1. **Verify before asserting.** Back a claim about behaviour with a command
   and its output, a test, or a log line; otherwise say it is unverified.
2. **Measure, do not argue.** Open questions in the design notes are
   settled by measurement.
3. **Small diffs, tight scope.** A fix does not bundle refactors; one PR,
   one change.
4. **Mechanical over judgement.** Labels, versions and routing come from
   path rules, Conventional-Commit parsing or CI.
5. **Same conventions as vivarium** unless this file says otherwise.

## 4. Repository conventions

### 4.1 Layout

| Path | What |
| ---- | ---- |
| `packages/terrarium/` | The npm/JSR package: the element, the Session, unit tests (`tests/`), browser tests (`e2e/`) |
| `web/` | The standalone page (also the iframe entry) |
| `docs/` | Astro + Starlight documentation and dedicated demos |
| `integration/` | Runtime descriptors, contracts and operating procedures |
| `scripts/` | Shared native guest resolution, staging and site assembly logic, called by CI and mise |
| `mise-tasks/` | Discoverable shell task entrypoints, including the common native builder |
| `fixtures/` | Projects preloaded into the terminal, and recorded sessions |
| `infra/github/` | OpenTofu for this repository's settings, ruleset and labels |

### 4.2 Version control

Jujutsu (`jj`) on a colocated Git repository. Commit and push with `jj`.
Before editing after a push, start a new change (`jj new`): the working
copy is a commit, and edits otherwise rewrite the pushed one.

### 4.3 Commits and pull requests

- **Conventional Commits**, checked by the org commitlint: `type(scope)?:
  subject`, the subject starting with a lowercase letter, at most 100
  characters, no trailing period.
- Every change goes through a pull request; `main` takes squash merges only.
- An AI-authored PR names the tool and model on the last line of its
  description.

### 4.4 Labels

`prefix: value` labels, defined in [`infra/github/main.tf`](infra/github/main.tf)
(never through the GitHub UI). `scope: *` comes from
[`.github/labeler.yml`](.github/labeler.yml) path rules and `type: *` from
the PR title's Conventional-Commit type.

### 4.5 GitHub Actions

- Every action is pinned to a full commit SHA with its version as a
  comment; the organization only runs pinned actions.
- Tools come from mise (`jdx/mise-action`), not from setup actions.
- Least-privilege `permissions:` per job, `persist-credentials: false` on
  checkouts that do not push, and `github.repository_owner ==
  'aletheia-works'` on jobs that write or use secrets.
- **A script made on Windows has no executable bit.** Set it with
  `jj file chmod x <path>`; `shell:check` fails on Linux when a script
  under `scripts/` or `mise-tasks/` is not executable.

### 4.6 Toolchain

Everything is in [`mise.toml`](mise.toml). Tasks named `<area>:check` are
read-only, `<area>:check:fix` apply fixes; tasks with loops or conditionals
live in `mise-tasks/`. Bun is the package manager; keep
`packages/terrarium/bun.lock` at `lockfileVersion` 1, which Dependabot
reads (write it with Bun 1.2 if a newer Bun rewrites it).

### 4.7 Pre-PR local validation

Run the matching task before pushing; the ruleset requires these checks.

| Task | Workflow |
| ---- | -------- |
| `lint:all` | `test-lint-check.yml` (Polyglot lint) |
| `ci:terrarium` | `test-terrarium.yml` (type-check, unit tests, build) |
| `ci:e2e` | `build-latest-guests.yml` (latest guests in Chromium, Firefox, WebKit) |

`lint-autofix.yml` runs `lint:all:fix` on every PR and
`lint-autofix-apply.yml` pushes the result back to the PR's branch with
`TF_TOKEN_GITHUB`. The patch is untrusted (it comes from running the PR's
own `mise.toml`), so the apply stage accepts only content edits to existing
files of a type the fixers handle, outside `.github/workflows/`. That token only
reaches this repository, so the push needs the branch to live here; for a
PR from a fork, run `mise run lint:all:fix` locally.

### 4.8 Builds, Pages and publishing

- **Guests** resolve every registered tool's latest stable release once per run.
  Prefer verified official static-musl binaries; otherwise build unmodified
  source with the registry-driven Cargo builder. Branches, commits, PRs and
  fork repositories use the same pipeline and retain exact source identities.
- **Build outputs** travel as Actions artifacts in the same run. Do not put
  them on `main` or the retired `builds` branch; do not add Emscripten or tool
  patches. New build systems or unsupported syscalls need compatibility work.
- **Pages** assembles documentation, demos and `/web/` with the pinned
  formicarium runtime. Node and Chromium/Firefox/WebKit acceptance must pass
  before deployment. Failed candidates preserve the previous site.
- **Browser isolation** must work on hosts without response-header controls.
  Keep the Service Worker at the site root so it covers demos and runtime
  Workers; document-only navigation must load no guest or Service Worker.
- **Session compatibility**: preserve the published `Session` API and the
  custom element/iframe contracts. Each CLI command creates a new execution
  instance and writes its disk changes back to the session.
- **Scope**: no general shell, arbitrary uploaded binaries, guest networking,
  Node.js/lifecycle scripts, or pitchfork daemon supervision. Built-ins are
  `ls`, `cat`, `rm -rf`, and `cd`. Side-by-side comparisons belong in Vivarium.
- **The package** is published to npm and JSR by
  `publish-terrarium.yml` on a `v<version>` tag, with OIDC and provenance.
- **Release Please** in `release.yml` prepares a repository-wide release PR,
  updating both public package manifests with one shared version. The first release is
  human-approved; optional weekly merges require separate maintainer activation
  and all main checks. Enable reconciliation only after the Bot and registries
  are configured; see `docs/src/content/docs/guides/releases.md`.

## 5. When in doubt

1. Read the [architecture](docs/src/content/docs/reference/architecture.md),
   [maintenance guide](docs/src/content/docs/reference/maintenance.md) and
   relevant documents in `integration/`.
2. Look at how vivarium does it.
3. If still unclear, stop and ask the human.

Use Issues, short design notes when needed, pull requests and CI for development.
No lifecycle framework, generated workflow records or audit hooks are required.
