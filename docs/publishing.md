# Publishing and provider handoff

## Pull requests and main

`.github/workflows/validate.yml` runs with read-only repository permissions. It
uses no repository secrets and does not use `pull_request_target`. It runs the
focused tests, validates manifests and CI policy, and builds the versioned ZIP.

## GitHub Release

`.github/workflows/release.yml` accepts a trusted `vX.Y.Z` tag push or a manual
run from `main` naming an existing tag. Before publishing it requires:

- the tag to exactly match `package.json` and every host manifest;
- the checked-out commit to exactly match the tag target;
- that commit to be an ancestor of `origin/main`;
- focused tests and validation to pass;
- public OAuth/MCP discovery to pass.

For a missing release, the workflow uploads the ZIP, readiness receipt, JSON
and Markdown provider handoffs, and SHA-256 checksums to a draft GitHub
Release. An existing draft can resume that upload. It downloads the assets,
checks every SHA-256 digest and the reproduced ZIP, and publishes only after
verification.

A published release is immutable in this workflow. A repeated run downloads
all five existing assets, requires the checksum file to cover the ZIP and every
receipt, verifies those hashes, and compares the published ZIP with a fresh
reproducible build. It reuses the published receipts because fields such as
`checkedAt` legitimately vary between runs; missing or divergent assets fail
the job, and no upload or release edit runs for that path.

Manual reruns can target an older tag that predates this reconciliation logic.
The ZIP is still built exclusively from the tagged checkout. After proving both
the tag and the workflow commit belong to trusted `main`, the job materializes
only its release-state and asset-verification helpers from the workflow commit
into `RUNNER_TEMP`; those helpers do not contribute files to the package.

The readiness receipt contains no token. If the optional
`FREELAW_REVIEW_MCP_TOKEN` secret exists, it can inspect the authenticated tool
catalog, but it does not execute reviewer cases or prove directory readiness.

## Provider submission

Provider work runs only through `workflow_dispatch` after release verification
and uses the protected `directory-submission` environment. Selecting a provider
records a handoff; it does not claim submission or approval.

OpenAI and Anthropic require their official portals, so the workflow stops at an
artifact suitable for an authorized publisher. No portal credential is stored or
printed.

For xAI, an operator can additionally set `execute_grok_pr` and supply a dedicated
`GROK_MARKETPLACE_TOKEN` environment secret. The job clones the configured fork,
adds the release commit as a full SHA-pinned catalog entry, runs the official
catalog generator and validator, pushes a release-specific branch, and opens or
reuses the upstream PR. This creates a review request; it does not mean xAI has
merged or published the plugin.

Meta/Muse Spark remains a handoff with `unverified` status because a compatible
official directory or submission API was not verified. Operators must establish
the current official route before attempting it.
