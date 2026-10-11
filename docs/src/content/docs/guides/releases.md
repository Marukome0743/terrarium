---
title: Release automation
description: Review a shared release version and publish the terminal package.
---

Terrarium uses one release version for the repository, npm and JSR. The root
`version.txt` is the repository version; `packages/terrarium/package.json` and
`packages/terrarium/jsr.json` carry the same version. The initial baseline is
`0.1.0`. Private documentation tooling has no public release version.

## Release flow

Release Please reads Conventional Commits across the repository and prepares a
release PR that updates `CHANGELOG.md`, `version.txt` and both package manifests.
Review its changelog and wait for the required checks, then merge the PR. This
creates a `v<version>` tag and GitHub Release. The tag triggers
`publish-terrarium.yml` to publish the terminal package to npm and JSR through
OIDC. The workflow filename stays unchanged for npm trusted publishing.

`fix` produces a patch and `feat` produces a minor. Before 1.0, breaking changes
produce a minor too. `docs`, `chore` and `ci` alone do not trigger releases.
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
5. After the first successful release, add Vivarium's weekly release PR merge
   workflow in a follow-up change. This first stage requires manual PR merging.

Until step 4, automatic reconciliation is skipped. This allows prerequisites to
be installed without failed Bot jobs or an unintended first release. No workflow
in this rollout bypasses the main ruleset or publishes from the setup PR.

## Recovery

For Release Please errors, fix the configuration or Bot permissions and run
**Release** again on `main`.

For a failed registry publication, run **publish-terrarium** manually with the
existing `v<version>` tag. It checks out that exact tag and requires repository,
npm and JSR versions to agree. Versions already published are skipped. Only HTTP
404 means unpublished; authentication, rate limits, server errors and malformed
responses stop the run. A GitHub Release can exist before both registries finish.
Do not use a branch name as the manual publishing input.

For package content fixes, merge a Conventional Commit fix and release the next
version. Do not replace existing registry versions or rewrite released tags.
