# Freelaw Studio MCP

The Freelaw Studio MCP server exposes the same public, organization-scoped
contract through Streamable HTTP.

## Endpoint

```text
https://app.freelaw.ai/api/agent/mcp
```

The package includes the ready-to-discover configuration in
[`plugins/freelaw-studio/mcp.json`](../plugins/freelaw-studio/mcp.json):

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
authorized connection through OAuth or a protected secret store according to
its own connection model. Never add `X-API-Key` to this file, a public prompt,
or a committed environment file.

After connecting, the agent should:

1. complete the MCP initialize handshake and read `initialize.instructions`;
2. call `tools/list` and inspect `inputSchema` and the live go-live metadata;
3. call the permissions and catalog tools before any write;
4. preserve idempotency keys and respect retry/polling guidance;
5. verify terminal results before communicating completion.

MCP tool names may be encoded by a host (for example,
`office__delegations__create`). The tool description and live schema win over
any name shown in a static example.

## Public boundary

This server is for Freelaw Studio client workflows. The package does not
describe internal administration or private service-to-service APIs. Consult
the [public developer documentation](https://freelaw.ai/developers/mcp) for
transport updates and the [go-live checklist](https://freelaw.ai/developers/go-live.json)
for acceptance evidence.
