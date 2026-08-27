# Freelaw Studio MCP

The Freelaw Studio MCP server exposes the same public, organization-scoped
contract through Streamable HTTP.

## Endpoint

```text
https://app.freelaw.ai/api/agent/mcp
```

The package includes two ready-to-discover configurations. The server is
the same Streamable HTTP endpoint; hosts disagree on the `type` string.

Grok / Claude / Codex (`.mcp.json`):

```json
{
  "mcpServers": {
    "freelaw-studio": {
      "type": "http",
      "url": "https://app.freelaw.ai/api/agent/mcp"
    }
  }
}
```

Agent Plugins / Cursor (`mcp.json`):

```json
{
  "mcpServers": {
    "freelaw-studio": {
      "type": "streamable-http",
      "url": "https://app.freelaw.ai/api/agent/mcp"
    }
  }
}
```

## Credential handling

The configuration intentionally has no secret. The MCP host must inject the
authorized connection through OAuth 2.1 + PKCE (preferred) or a protected
secret store. Discovery lives at
`https://app.freelaw.ai/.well-known/oauth-protected-resource`. Never add
`X-API-Key` to this file, a public prompt, or a committed environment file.
Never paste `flk_` into chat.

After connecting, the agent should:

1. Use the permission-filtered catalog already returned by the host. Do not
   call `office.permissions.describe` or `tools/list` as a ritual on every
   user question.
2. Prefer one domain tool immediately (`office.dailySummary.get` for "what do
   I have today").
3. Call `office.catalog.list` only when creating a service (OS); never invent
   catalog UUIDs.
4. Preserve idempotency keys and respect retry/polling guidance.
5. Verify terminal results before communicating completion.

Integrators validating a new connection can read
`_meta.freelaw.goLive.tryItSequence` on `tools/list` once — not per user
question.

MCP tool names may be encoded by a host (for example,
`office__delegations__create`). The tool description and live schema win over
any name shown in a static example.

## Public boundary

This server is for Freelaw Studio client workflows. The package does not
describe internal administration or private service-to-service APIs. Consult
the [public developer documentation](https://freelaw.ai/developers/mcp) for
transport updates and the [go-live checklist](https://freelaw.ai/developers/go-live.json)
for acceptance evidence.
