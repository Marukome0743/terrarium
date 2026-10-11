---
title: Source builds
description: Register a branch, commit or pull request without changing the latest default.
---

Pages builds the latest stable releases of all registered tools. A source build
adds a selectable build without replacing that default.

Run the **Pages** workflow manually with a registered `tool`, a `ref` (branch,
tag, commit, or `pr-123`) and optionally a fork's `owner/repo` as `repository`.
Builds must finish and pass Node and browser acceptance before deployment.

For repeatable registrations, add an entry to `web/tool-refs.json`. The common
native builder uses the Cargo package and binary settings in `web/tools.json`;
a new tool still needs a compatible builder and supported system calls.

A branch name alone is not a published build. After deployment, select the
registered build from the [console](/terrarium/web/), or pass its catalog key as
`ref` in the URL. The aube demo accepts `ref`, `fixture`, `cwd` and repeated `run`
parameters too. Preserve the exact key shown in `web/dist/builds.json`.

Use Vivarium to present a reproduction and compare before and after builds.
