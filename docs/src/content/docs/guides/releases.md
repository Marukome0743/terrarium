---
title: Release automation
description: Review a shared release version and publish the terminal package.
---

Terrarium uses one release version for the repository, npm and JSR. `packages/terrarium/package.json` and
`packages/terrarium/jsr.json` carry the same version. No separate repository
version file is needed. The initial baseline is
`0.1.0`. Private documentation tooling has no public release version.

## Release flow

Release Please reads Conventional Commits across the repository and prepares a
release PR that updates `CHANGELOG.md` and both package manifests.
Review its changelog and wait for the required checks, then merge the PR. This
creates a `v<version>` tag and GitHub Release. The tag triggers
`publish-terrarium.yml` to publish the terminal package to npm and JSR through
OIDC. The workflow filename stays unchanged for npm trusted publishing.

`fix` produces a patch and `feat` produces a minor. Before 1.0, breaking changes
produce a minor too. `docs`, `chore` and `ci` alone do not trigger releases.
The existing `simple` strategy keeps repository-wide commit collection. Its
optional `version.txt` update is skipped when the file is absent; it is not
recreated. Release Please tracks the last released version in its existing
manifest and GitHub tags, and updates the two public JSON manifests together.
Publishing checks their versions and the `v<version>` tag agree.

Historical `terrarium-v*` tags retain their contents; new releases use `v*`.
The bootstrap SHA is the main commit before this migration. The first changelog
starts with subsequent commits, rather than replaying the repository's history.

Release configuration tests use Release Please `17.6.0`, the engine bundled in
`release-please-action` v5.0.0. Upgrade that test dependency alongside the action.
The tests verify version bumps, both JSON updates, and the release tag's commit
without contacting GitHub or publishing anything.

## Staged rollout

1. Merge this configuration. OpenTofu creates `autorelease: pending` and
   `autorelease: tagged`. A successful **Terraform Apply** reruns reconciliation.
2. Confirm the `aletheia-works-bot` installation includes this repository and has
   Contents, Issues and Pull requests write permissions. Provide `BOT_CLIENT_ID`
   and `BOT_PRIVATE_KEY` using the existing organization Bot configuration.
   Credential setup is a maintainer action; never commit the private key.
3. Verify npm's trusted publisher points to `aletheia-works/terrarium` and
   `publish-terrarium.yml`, and confirm JSR permits the existing OIDC publisher.
4. Set the repository variable `RELEASE_AUTOMATION_ENABLED` to `true`, then run
   **Release** on `main`. Review and merge the first release PR to authorize
   tag creation and publication. Confirm the GitHub Release and both registries.
5. After confirming the first GitHub Release and successful npm/JSR publication,
   set `WEEKLY_RELEASE_MERGE_ENABLED` to `true`. The first release remains manually
   reviewed; weekly merging is disabled until this separate activation.

Until step 4, automatic reconciliation is skipped. This allows prerequisites to
be installed without failed Bot jobs or an unintended first release. No workflow
in this rollout bypasses the main ruleset or publishes from the setup PR.

## Weekly release PR merge

**Merge release PR** runs every Monday at **09:23 JST (00:23 UTC)**, or manually
from Actions on `main`. GitHub may delay scheduled execution. Both
`RELEASE_AUTOMATION_ENABLED` and `WEEKLY_RELEASE_MERGE_ENABLED` must be `true`.
Setting the weekly variable to `false` pauses future merge requests; to stop an
already requested auto-merge, disable auto-merge on that PR too.

The workflow selects one open, non-draft PR targeting `main`, with the exact
`release-please--branches--main--components--terrarium` branch, the
`autorelease: pending` label, and `aletheia-works-bot` as author. Fork PRs are
excluded. No candidate is a successful no-op; multiple candidates stop the run.
It requests squash auto-merge for the selected head SHA and does not bypass
required checks or reviews. If requirements remain unsatisfied, GitHub waits;
merging may therefore happen after Monday. A changed head at the time of the
request is rejected, and later changes still need to pass the main ruleset.

Release reconciliation and merge requests share the `release-please` concurrency
group. The App token ensures that merging triggers reconciliation and publishing.
This workflow only requests a PR merge; publication runs separately.

## Recovery

For Release Please errors, fix the configuration or Bot permissions and run
**Release** again on `main`.

For weekly merge errors, inspect the reported candidate, head SHA, conflicts,
checks and reviews, then rerun **Merge release PR** on `main`.

For a failed registry publication, run **publish-terrarium** manually with the
existing `v<version>` tag. It checks out that exact tag and requires repository,
npm and JSR versions to agree. Versions already published are skipped. Only HTTP
404 means unpublished; authentication, rate limits, server errors and malformed
responses stop the run. A GitHub Release can exist before both registries finish.
Do not use a branch name as the manual publishing input.

For package content fixes, merge a Conventional Commit fix and release the next
version. Do not replace existing registry versions or rewrite released tags.
