# Freelaw Studio

Official client plugin for [Freelaw Studio](https://freelaw.ai). Connects Grok, Gemini, Claude, Codex, and Cursor to an organization-scoped law office through the public hosted MCP.

No admin, Backstage, or internal-operations access.

## What it ships

- Remote MCP only. No local process, hooks, install scripts, or binaries.
- Skills: `studio`, `delegacoes`, `peticoes`, `processos`, `clientes`, `prazos`, `publicacoes`, `documentos`
- Commands: `/conectar`, `/permissoes`, `/os`, `/peticao`, `/prazos`, `/intimacoes`

## Network endpoints

| Host | Why |
| --- | --- |
| `https://app.freelaw.ai/api/agent/mcp` | Hosted Streamable HTTP MCP |
| `https://app.freelaw.ai/oauth/register` | OAuth 2.1 dynamic client registration |
| `https://app.freelaw.ai/oauth/token` | OAuth 2.1 token exchange |
| `https://app.freelaw.ai/.well-known/*` | RFC 9728 protected-resource + authorization-server discovery |
| `https://app.freelaw.ai/api/agent/*` | Public HTTP contract (`list`, `openapi`, `status`) |
| `https://freelaw.ai/developers` | Public docs |

No telemetry SDKs, no third-party analytics, no `postinstall`.

## Credentials

OAuth 2.1 with PKCE (`office:read` / `office:write`), managed by the host on first connect. No API key is bundled. Never paste `flk_`, cookies, or refresh tokens into chat.

Alternative: a host-managed `flk_` key in a secret store. Same scopes. Still never in a prompt or this repo.

### Claude Code

```bash
claude plugin marketplace add Freelaw-S-A/freelaw-studio-agent-plugin
claude plugin install freelaw-studio@freelaw-studio
```

Claude and ChatGPT hosted connectors use `https://app.freelaw.ai/api/agent/mcp` with host-managed OAuth. Marketplace installation and official directory approval are separate release states.

## Hosts

- **Grok Build:** marketplace install of `freelaw-studio`. `.mcp.json` uses `type: http`.
- **Grok chat:** custom connector `https://app.freelaw.ai/api/agent/mcp` (no Authorization header).
- **Gemini CLI:** `gemini extensions install https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin`.
- **Claude / Codex / Cursor:** remote MCP; host runs OAuth. Agent Plugins `mcp.json` stays `streamable-http`.

## Client journeys

The `studio` skill coordinates five client workflows: write a petition,
delegate a piece, research jurisprudence, create a task, and analyze a
publication through its deadline/task/client-notice follow-ups. It also covers
the daily office overview and document context. The live catalog and server
responses remain authoritative for availability, approvals, quota and cost;
the plugin does not invent prices, require an upgrade, or repeat blocked calls.

## Safety (legal work product)

- Confirm the exact target and effect before any write, upload, generation, send, or delete.
- This plugin does not give autonomous legal advice and does not make high-impact legal decisions.
- A qualified lawyer must review any AI-generated output before it is used, shared, filed, or finalized.
- Tell the user when AI contributed to a response or document. Never present AI output as exclusively human-authored.

Do not send real client data to staging. Use a test organization with synthetic records and minimum scopes.

## License

MIT. See [LICENSE](./LICENSE).

## Privacy and support

- [Privacy policy](https://freelaw.ai/politica-de-privacidade)
- [Terms of use](https://freelaw.ai/termos-de-uso)
- [Support](https://freelaw.ai/developers/support.json)

Repo docs: [API](https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin/blob/main/docs/api.md), [MCP](https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin/blob/main/docs/mcp.md), [agent behavior](https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin/blob/main/docs/agent.md).

## Portugues

Pacote cliente do Freelaw Studio. Skills, comandos e MCP sao publicos; credenciais, escopos e autorizacao ficam sob controle do host e do escritorio autenticado. Nunca cole `flk_`, cookies ou refresh tokens no chat. Um profissional juridico habilitado deve revisar qualquer saida gerada por IA antes de uso, compartilhamento, protocolizacao ou finalizacao.
