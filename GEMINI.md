# Freelaw Studio

Use this extension to operate a Freelaw Studio office through the public MCP at
`https://app.freelaw.ai/api/agent/mcp`. It is organization-scoped. It has no
internal administration capability.

## Connect

1. Install: `gemini extensions install https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin`
2. Optionally confirm OAuth readiness at `https://app.freelaw.ai/api/agent/status`.
3. Complete OAuth 2.1 + PKCE when prompted. Never paste an `flk_` key into chat.
4. Discovery: `https://app.freelaw.ai/.well-known/oauth-protected-resource`
5. Call `office.permissions.describe`, then `tools/list`. Live schemas win.

## Safe sequence

1. Discover permissions and the live catalog.
2. Resolve catalog UUIDs with `office.catalog.list` before creating a service. Required create fields: `title`, `serviceType`, `legalArea`.
3. Writes need explicit confirmation, a unique `idempotencyKey`, and a later read.
4. Documents: `createUploadUrl` → PUT to the signed URL → `confirmUpload`. Never log `uploadUrl`.
5. Petitions: generate with `documentType` (`initial_petition` | `defense` | `appeal` | `memo`) → poll `nextPollAfterSeconds` → download only when `ready=true`.
6. If generation returns `insufficient_ai_credits`, tell the user to add credits in Studio; do not retry in a loop.
7. Preserve `X-Correlation-ID`. Do not log tokens, PII, or document contents.

Legal work product requires review by a qualified professional before filing or client delivery. Disclose AI assistance. Never present AI output as exclusively human-authored.
