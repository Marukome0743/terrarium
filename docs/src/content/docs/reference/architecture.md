---
title: Architecture
description: Runtime boundaries, terminal contracts and project scope.
---

terrarium makes one CLI build usable in a browser terminal. It runs locally in
the reader's browser; a server never executes the commands. Vivarium consumes
terrarium to present baseline/fix comparisons and explain reproductions.

## Runtime and terminal

```text
Astro documentation / dedicated demo / standalone console / iframe consumer
  -> <terrarium-terminal> and xterm.js
     -> terminal session, command queue and persistent virtual disk
        -> pinned formicarium runtime in Web Workers
           -> selected static x86-64 musl ELF guest
```

The terminal element lives in `packages/terrarium`. The standalone `/web/`
console and iframe use that same implementation. Dedicated demo pages configure
it rather than implementing another terminal. npm and JSR publish the element
and session APIs as `@aletheia-works/terrarium`.

Each CLI command starts a fresh execution instance. Files written by a command
are retained on the session disk and supplied to the next command. Calls are
queued; disconnecting or switching tools invalidates old work. Preserve the
published `Session` API, element attributes/events, and iframe protocol when
changing the adapter. The iframe approves exact parent origins before commands
or notifications are exchanged.

The formicarium package is pinned to `@aletheia-works/formicarium@0.2.1`.
The fixed descriptor in `integration/formicarium-inputs.json` identifies the
runtime, resolver and accepted input assets. The npm tarball SHA256 is
`71ae44f6f8d9de62cda1256e293025bcb40c67c00836f99767e435c478df7e35`.
Preparation verifies package version, registry integrity, tarball digest and
fixed-file identities before dependency installation or assembly.

## Guest selection

`web/tools.json` registers aube, pitchfork and Biome, their fixtures and native
builder metadata. Latest stable releases resolve to concrete tags and full
commits once per run. Prefer verified official static-musl binaries; otherwise
compile unmodified source using the common Cargo builder.

`web/tool-refs.json` adds persistent named builds for branches, tags, commits
and PR heads, including fork repositories. These selections do not replace the
latest stable default. The resolved repository, requested ref and full commit
remain part of the catalogue identity. Use [Source builds](/terrarium/guides/source-builds/)
for registration and [Embedding](/terrarium/guides/embedding/) for consumption.

New tools require a compatible executable, builder and runtime syscall support.
A different build system needs an adapter; registration alone cannot make an
unsupported guest run.

## Scope

- One terminal executes one selected build. Comparisons and reproduction
  narratives belong in Vivarium.
- Built-in commands are `ls`, `cat`, `rm -rf` and `cd`. There is no general shell
  or arbitrary uploaded-binary execution.
- Guest networking, Node.js and package lifecycle scripts are outside the scope.
- Pitchfork commands requiring a daemon supervisor are outside the scope.
- The retired Emscripten compiler/runtime and local tool patches are not part of
  the current pipeline.

## Browser isolation and deployment

GitHub Pages cannot configure the required COOP/COEP response headers. The
root-scoped `coi-serviceworker.js` supplies them for demos and the shared `/web/`
runtime. First installation waits for worker control before reloading; retries
are bounded across navigations. Page navigation uses `require-corp`; Worker and
module responses use `credentialless` to keep the module graph working in
WebKit. Keep both first-visit and repeated-navigation acceptance tests.

Opening documentation alone registers no Service Worker and downloads no guest.
The site assembly stamps module/catalogue URLs to avoid stale combinations after
Pages deploys. Candidate replacement is transactional: a failed preparation,
staging, assembly or acceptance keeps the previous usable candidate.

Measure guest download size, initialization time and time to first output before
making performance-driven architecture changes. Old Emscripten measurements do
not describe the current runtime.
