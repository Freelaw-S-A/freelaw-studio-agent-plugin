# Marketplace submission brief

This package exposes only the public Freelaw Studio MCP endpoint. It contains no
credentials, customer records, cookies, or private service endpoints.

## Reviewer setup

- Endpoint: `https://app.freelaw.ai/api/agent/mcp`
- Authentication: OAuth 2.1 with PKCE, managed by the host
- Scopes: `office:read`, `office:write`
- Test data: synthetic organization and synthetic legal records only
- Support: https://freelaw.ai/developers/support.json
- Privacy: https://freelaw.ai/politica-de-privacidade
- Terms: https://freelaw.ai/termos-de-uso

## Safety expectations

The agent must discover permissions and tools before acting, keep all reads and
writes organization-scoped, require explicit confirmation for mutations, preserve
correlation IDs without logging secrets or legal content, and require professional
review before AI-generated legal work product is relied upon or finalized.

## Release

Version 0.2.0 hardens the package for Claude and OpenAI review with an explicit
Claude manifest, privacy links, legal human-in-the-loop guidance, and reviewer
homologation instructions.
