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

The workflow publishes the ZIP, readiness receipt, JSON and Markdown provider
handoffs, and SHA-256 checksums to the GitHub Release, then verifies every asset
through the GitHub API. The readiness receipt contains no token. If the optional
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
