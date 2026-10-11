# Latest stable tool builds

Pages resolves GitHub's latest stable release for every registered tool on each
daily run, site-changing push to main, and manual deployment. Source defaults
are `latest`; deployed defaults are concrete tags.

The `build-latest-guests.yml` workflow runs directly on PRs and is reusable by
Pages. PR updates cancel older runs of the same PR; Pages calls use separate
concurrency groups. The direct PR job uses its default `guests` name, matching the OpenTofu-managed
required check. It resolves each tag and full commit
once. It prefers the official x86-64 static musl release archive, verifies its
publisher SHA256 and size, extracts its executable without following archive
links, and validates the ELF before use. It records the release URL and archive
digest; the source commit identifies the release tag, not a reproducibility
attestation for the publisher's binary.

Aube v2.7.0 uses its official musl binary without a source build. Pitchfork
v2.30.1 only publishes a dynamically linked glibc Linux binary, so terrarium
compiles the resolved upstream commit to static musl without local patches.
Its UI uses the official aube binary and Node 24.21.0. Cargo and rustc come from
terrarium's pinned mise installation, bypassing upstream contributor wrappers.
Build-time mise executions name Rust or Node explicitly and disable automatic
installation (`MISE_AUTO_INSTALL=0`). The setup step installs bun/node/rust, and
the UI Node version is installed explicitly. This prevents compiler discovery
from installing unrelated lint/OpenTofu tools or consuming anonymous GitHub API
quota. Latest release resolution still uses the authenticated `GH_TOKEN` step.
The musl ioctl fix is already upstream; no obsolete patch is needed.

Before publishing the guest catalogue, the workflow executes each guest's
`--version` command in Node, Chromium, Firefox, and WebKit. Browser tests also
verify the selected tag and source commit. Failed resolution, compilation or
acceptance prevents deployment and leaves the previous deployed site available.

`TERRARIUM_GUEST_SITE` selects the generated catalogue during assembly. All
registered tools must match the resolved repositories, tags and commits.
Assembly validates asset digests, ELF format and provenance before switching the
candidate. Fixed RC inputs still supply the pinned runtime and validation helpers. Latest
guests use terrarium's resolver with explicit `git-unmodified` source identity
and an empty `sourcePatches` list, instead of the frozen resolver's historical
pitchfork patch-SHA requirement. The fixed acceptance resolver stays unchanged. Their
historical guest defaults cannot override this generated catalogue. Without the
variable, fixed RC acceptance retains its recorded versions.

New tools use the same release policy and must have a compatible official asset or native builder, plus runtime
support before registration. Missing builders or unsupported guests stop the
run. A tool without stable GitHub releases requires an agreed alternative policy.
Manual ref builds use the same formicarium pipeline and add source selections
without replacing the latest stable defaults.

## Local reproduction

Linux x86-64 needs mise, musl-tools, make, CMake and Perl. Prepare the pinned RC
inputs and package dependencies through the normal input workflow, then run:

```sh
mise install
mise exec -- node scripts/latest-guests.mjs resolve .vendor/native/resolutions.json
mise exec -- node scripts/latest-guests.mjs build .vendor/native/resolutions.json .vendor/native
mise exec -- node scripts/latest-guests.mjs stage .vendor/native/resolutions.json .vendor/latest-guests .vendor/formicarium-inputs/resolver
TERRARIUM_GUEST_SITE=.vendor/latest-guests mise run site:build
mise exec -- node scripts/check-latest-guests.mjs .site
cd packages/terrarium
TERRARIUM_BUN=$(mise which bun) TERRARIUM_SITE_DIR=$(pwd)/../../.site mise exec -- bun x playwright test --config playwright.latest.config.ts
```

## Local acceptance, 2026-10-10

The GitHub resolver returned aube v2.7.0 at
`d36fec01764689ef6d99a5e43de98925b571d67f` and pitchfork v2.30.1 at
`1054549e85470b08d9507e2c82c850959a4b3914`.

The local candidate uses the official aube release archive:
`aube-v2.7.0-x86_64-unknown-linux-musl.tar.gz`, SHA256
`fc2384d58c560415f6afdfdc7c0f2d10b10f464da608bf1d8be5c8936db68666`.
Pitchfork uses the existing unmodified native build of the resolved source for
local Mac execution checks; Linux CI builds that commit with pinned Rust.
Both passed Node execution and all six browser version/commit checks
(Chromium, Firefox and WebKit; 12.7 seconds). Package CI passed type-check,
166 tests / 612 assertions and build. `mise run lint:all` passed.

Commands: `node scripts/check-latest-guests.mjs .vendor/site-latest` and
`playwright test --config playwright.latest.config.ts` with the candidate site
and bun paths explicitly set. The PR's latest-guests workflow additionally
checks the fresh Linux source build before accepting its catalogue.

## Biome latest

Biome uses the official `biome-linux-x64-musl` standalone executable, verified
against the release asset SHA256 and size before ELF validation. Its scoped tag
(`@biomejs/biome@<version>`) remains the source/build identity; version assertions
extract the numeric version without replacing that tag. Latest resolution runs
for every registered tool, including Biome, on each acceptance and deployment.

The `biome-basic` fixture includes a formatting example and an intentional
`debugger` lint violation. Node and Chromium/Firefox/WebKit verify formatting,
file persistence, and lint diagnostics in addition to version/source identity.
Latest catalogues use terrarium's manifest validator for declared tools and
verified static-musl guests. Fixed RC catalogues and validators stay unchanged.

## Registered source refs and Vivarium comparison

`web/tool-refs.json` registers additional source builds without changing the
latest stable defaults. Each entry specifies a registered `tool`, optional
`repository` (`owner/repo`, including forks), `ref` (branch, tag, full commit, or
`pr-<number>`), a selection `name` unique within that tool, and optional `fixture`.
Repository and fixture default to the tool's entries in `web/tools.json`.
Resolution captures the full commit once. PR refs use the requested repository's
PR head commit. Provenance retains the requested repository/ref/commit and PR URL;
catalogue assets are content-addressed and validated before use.

```json
{
  "refs": [
    {"tool": "aube", "repository": "owner/aube-fork", "ref": "fix/example", "name": "aube-fix"},
    {"tool": "pitchfork", "ref": "pr-123", "name": "pitchfork-pr-123"}
  ]
}
```

All registered tools use the same resolver, source-build matrix and registration
path. `native` in `web/tools.json` describes the Cargo package/binary, whether
an empty aube primer is needed, and whether UI assets need building with aube.
New compatible Rust CLIs can use `native.kind: "cargo"` and their own repository,
fixture and binary name without adding a repository-specific branch to the
resolver. Other build systems need a builder adapter; the executable must still
be static x86-64 musl and compatible with formicarium's supported system calls.
Both existing tools and new tools require execution acceptance before use.
Sources are compiled without local Emscripten or tool patches.

The registered comparison uses JamBalaya56562's fix branch and its parent:

- Before: `2405c7620169bd0719166af09a8d89cc76fb37fb`, `migrate-prettier-before`.
- After: `fix/migrate-prettier-default-semi-quotes`, `migrate-prettier-after`.

The `biome-migrate-prettier` fixture starts with empty `biome.json` and
`.prettierrc`. Run `biome migrate prettier --write`, then `cat biome.json`.
Node and all three browsers assert `asNeeded`/`single` before and
`always`/`double` after. Each terminal owns a separate session/disk.

After deployment, use these two URLs as Vivarium terminal sources:

```text
https://aletheia-works.github.io/terrarium/?tool=biome&ref=migrate-prettier-before&fixture=biome-migrate-prettier
https://aletheia-works.github.io/terrarium/?tool=biome&ref=migrate-prettier-after&fixture=biome-migrate-prettier
```

The same `tool`, `ref`, and `fixture` attributes work on the custom element and
iframe. Add `run=biome%20migrate%20prettier%20--write&run=cat%20biome.json` for
an automatic recorded run. The displayed source identity distinguishes the
original requested ref from its exact compiled commit.

Pages manual dispatch accepts any registered `tool`, optional `repository`
(`owner/repo`), and a branch, tag, commit or `pr-<number>` in `ref`. It adds the
source build to the same validated candidate. Its generated selection name is
`<owner>-<repo>-<commit-first-12>`; the tool, commit and name are recorded in
`tool-ref-resolutions.json` inside the `latest-guests` artifact. Open
`?tool=<tool>&ref=<selection-name>` after successful deployment.

Configured comparisons are rebuilt on subsequent deployments; one-off manual
refs last until the next catalogue replacement. Add a ref to `web/tool-refs.json`
to retain it across deployments. Build outputs travel through GitHub Actions
artifacts and are not stored on the legacy `builds` branch. The old `force`
input is unnecessary: each run resolves exact source identities and compiles
selected sources, reusing compilation caches without skipping acceptance.

### Parallel source acceptance

Source identities are resolved once before dispatch. The latest stable acquisition
and each registered source build run as independent jobs; Source jobs have
separate compilation caches. The candidate job gathers their artifacts, validates
provenance and runs Node acceptance. Chromium, Firefox and WebKit then run in
parallel. The required `guests` check succeeds only when all these jobs succeed,
including on reusable Pages calls.

GitHub Actions shows build and acceptance durations per job. Each successful source
build also records its selection, resolved commit and build time in the job summary.
Parallelism reduces sequential waiting; it does not reduce the compilation work for
a cold source build.
