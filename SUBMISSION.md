# Marketplace submission brief

This package exposes only the public Freelaw Studio MCP endpoint. It contains no
credentials, customer records, cookies, or private service endpoints.

Official xAI catalog compare (this GitHub App token cannot open PRs on `xai-org`):

https://github.com/xai-org/plugin-marketplace/compare/main...Freelaw-S-A:feat/add-freelaw-studio?expand=1

Pin: `https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin.git` @ merge SHA of this repo, `path: plugins/freelaw-studio`.

## Reviewer setup

- Endpoint: `https://app.freelaw.ai/api/agent/mcp`
- Authentication: OAuth 2.1 with PKCE, managed by the host. Never paste `flk_` into chat.
- Scopes: `office:read`, `office:write`
- Discovery: `https://app.freelaw.ai/.well-known/oauth-protected-resource`
- Test data: synthetic organization and synthetic legal records only
- Support: https://freelaw.ai/developers/support.json
- Privacy: https://freelaw.ai/politica-de-privacidade
- Terms: https://freelaw.ai/termos-de-uso
- Walkthrough: [`docs/freelaw-studio-review.gif`](docs/freelaw-studio-review.gif)
- License: MIT, in repo root and in `plugins/freelaw-studio/LICENSE`

## Host packaging

| Host | Install | Config notes |
| --- | --- | --- |
| Grok Build | `grok plugin marketplace add` this repo, then `grok plugin install freelaw-studio` | `.mcp.json` **must** be `"type": "http"` |
| Grok chat | Custom connector URL above, no Authorization header | Hosted UI discovers OAuth from the 401 |
| Gemini CLI | `gemini extensions install https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin` | Root `gemini-extension.json` uses `httpUrl` + `oauth.enabled` |
| Claude / Codex / Cursor | Remote MCP URL; host runs OAuth | Agent Plugins `mcp.json` stays `streamable-http` |

## Safety expectations

The agent must discover permissions and tools before acting, keep all reads and
writes organization-scoped, require explicit confirmation for mutations, preserve
correlation IDs without logging secrets or legal content, and require professional
review before AI-generated legal work product is relied upon or finalized.

## Release

Version 0.3.1 is the marketplace-ready pin: LICENSE inside the plugin path,
English reviewer README, brand-scoped keywords, hosted MCP only.
