# Security

This plugin ships no credentials, no hooks, no install scripts, and no local binaries. It registers one hosted MCP server.

## Network

- `https://app.freelaw.ai/api/agent/mcp` — Streamable HTTP MCP
- `https://app.freelaw.ai/oauth/register` and `/oauth/token` — OAuth 2.1 PKCE
- `https://app.freelaw.ai/.well-known/*` — RFC 9728 discovery
- `https://app.freelaw.ai/api/agent/*` — public HTTP contract

Nothing else is contacted from the plugin files. No telemetry.

## Credentials

Host-managed OAuth 2.1 PKCE (`office:read`, `office:write`) or a secret-store `flk_` key. Never paste tokens into chat, commits, or logs.

## Scope

Organization-scoped Studio actions only. No admin, Backstage, filesystem, or shell access.

To report an incident, preserve `X-Correlation-ID` without customer data and use [support](https://freelaw.ai/developers/support.json).
