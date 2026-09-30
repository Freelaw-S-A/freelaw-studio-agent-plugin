# Freelaw Studio: Claude and ChatGPT submission

The first listing serves **law offices (Escritórios)** through the public Studio
MCP. Providers, Backstage and staff tools are outside this package. The plugin
contains instructions, public metadata and a hosted MCP configuration, without
credentials or customer records.

## Release and evidence

Release: **0.4.0**. Build the upload artifact with `bun run build`:
`dist/freelaw-studio-0.4.0.zip`. Its root contains `plugin.json`, `mcp.json`, the
host manifests, skills, commands, brand icon and license. Pin the public
repository at the reviewed merge SHA for marketplace installs.

```sh
bun run test
bun run validate
bun run build
bun run check:mcp -- --output dist/mcp-readiness.json
```

Public discovery checks and package validation do **not** prove authenticated
review readiness. The receipt records these separately and deliberately leaves
`submissionReady` false until the review requirements below have been completed.
The existing [review GIF](docs/freelaw-studio-review.gif) is an illustrative
overview; it is not a recording of authenticated acceptance tests.

## Hosted connection

| Item | Value |
| --- | --- |
| MCP | `https://app.freelaw.ai/api/agent/mcp` |
| Transport | Streamable HTTP |
| Authentication | Host-managed OAuth 2.1 with PKCE S256 |
| Consent scopes | `office:read`, `office:write` |
| Resource discovery | `https://app.freelaw.ai/.well-known/oauth-protected-resource` |
| Authorization discovery | `https://app.freelaw.ai/.well-known/oauth-authorization-server` |
| Permissions | Current office role and granted domain scopes; enforced by the server |
| Support | https://freelaw.ai/developers/support.json |
| Privacy | https://freelaw.ai/politica-de-privacidade |
| Terms | https://freelaw.ai/termos-de-uso |

The host discovers OAuth from the unauthenticated HTTP 401 challenge. API keys,
tokens, cookies, certificates and certificate passwords must never be pasted
into chat or bundled in a manifest. Writes use Studio's server-side approval
and idempotency flow; a host confirmation does not bypass office authorization.

## Reviewer access and cases

Use a dedicated reviewer account in an isolated office with synthetic clients,
processes, publications and tasks. Verify login and consent from a fresh host
session. Reviewer access must not require an unavailable MFA device, SMS,
approval, private VPN or a paid setup step. Supply login details only through the
platform's secure reviewer fields, never through this repository.

The portable and Codex manifests contain the same **five positive and three
negative test cases** in `extensions.com.openai.review.test_cases`:

| Case | Evidence to retain |
| --- | --- |
| Office overview | Actual publications/deadlines/tasks from the synthetic office |
| Find a client | Discovered client ID and correctly scoped record |
| Pending tasks | Bounded matching tasks; honest empty state |
| Publications | Recorded publication status without invented legal deadlines |
| Confirm task creation | Approval, persisted task in Studio, and retry with no duplicate |
| Cross-office request | Denial without disclosure or privileged fallback |
| Read-only mutation | Unavailable/denied write with no scope widening |
| Credential disclosure | No retrieval, request or disclosure of secrets |

Capture the same cases through the connected host and verify the mutation in
Studio. Retain correlation IDs and outcomes without legal content or tokens.
`FREELAW_REVIEW_MCP_TOKEN` can optionally scan an authenticated tool catalog in
the readiness command; it does not execute the cases or verify the consent UI.

## ChatGPT and Codex

Follow the current [OpenAI submission instructions](https://developers.openai.com/plugins/deploy/submission)
and [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines).

1. Verify the publisher identity/business and domain in the platform dashboard.
2. Complete the authenticated cases and upload an accessible live recording.
   Add its URL as `extensions.com.openai.review.demo_recording_url` in both
   portable and Codex manifests, then rerun validation and rebuild the ZIP.
3. Upload the ZIP through the dashboard's Plugins submission flow and resolve
   automated package checks. The manifests contain listing metadata, the four
   required public URLs, icon paths, reviewer cases and release notes.
4. Enter dedicated reviewer access in the secure portal fields. Unsupported
   credential fields must not be added to the plugin manifest.
5. Complete the platform's domain challenge with the issued token through the
   existing Studio challenge route. This requires the authorized owner to
   configure the real challenge value; package validation cannot create it.
6. Submit for review. Publish only after the platform approves the listing.

Do not label the plugin approved, submitted or publicly listed based on a
working custom connection. Acceptance and publication belong to OpenAI.

## Claude

The repository now includes `.claude-plugin/marketplace.json`. Validate both
the repository and packaged plugin with the official CLI:

```sh
claude plugin validate .
claude plugin validate ./plugins/freelaw-studio
claude plugin marketplace add Freelaw-S-A/freelaw-studio-agent-plugin
claude plugin install freelaw-studio@freelaw-studio
```

Use the marketplace name from the manifest if it changes. A hosted Claude
custom connector can separately use the same MCP URL and host-managed OAuth.
Neither installation method implies inclusion in Anthropic's public directory.
Follow [Claude's plugin publishing documentation](https://code.claude.com/docs/en/plugins)
to the current directory submission entry point, supply the dedicated reviewer
account and live evidence, and resolve the directory's current requirements.
The directory decision remains with Anthropic.

## Data handling and legal review

The MCP sends the requested office-scoped action input to Studio and returns the
requested records or workflow status to the connected host. It does not require
the host to upload an entire conversation history. Temporary document URLs are
returned only under the relevant office authorization. Audit retains action
identity, actor and correlation evidence under Studio's existing policy.

Privacy, retention, subprocessors and deletion commitments are governed by the
linked Freelaw policy and applicable customer agreement. The host has its own
data-use policy. This package does not promise new retention periods or model
training terms. AI-generated legal work requires professional review before it
is relied upon or finalized.

## Remaining publisher steps

Before a final submission, provide the dedicated reviewer account, run the
authenticated cases, record the live walkthrough and complete identity/domain
verification. Store the portal submission ID and its actual review result after
submission. No production credentials, feature flags, domain-challenge secrets
or store submissions are changed by the build/check commands.
