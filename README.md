# Freelaw Studio Agent Plugin

Public package to connect agents to Freelaw Studio via the public API and
remote MCP. Built for clients, integrators, and legal teams. No admin
capabilities.

Official xAI marketplace listing: open
[this compare](https://github.com/xai-org/plugin-marketplace/compare/main...Freelaw-S-A:feat/add-freelaw-studio?expand=1)
(the GitHub App token used in automation cannot create PRs on `xai-org`).

Until that lands, Grok Build can still install from this repo:

```bash
grok plugin marketplace add https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin.git
grok plugin install freelaw-studio --trust
```

## What is in this repository

- `plugins/freelaw-studio/`: portable [Agent Plugins](https://agent-plugins.org/) package with skills, commands, MCP config, LICENSE, and Grok/Claude/Codex/Gemini manifests.
- `gemini-extension.json` and `GEMINI.md` at the repo root: Gemini CLI install.
- `.grok-plugin/marketplace.json`: local marketplace for Grok Build.
- `docs/api.md`: HTTP contract, auth, live action discovery.
- `docs/mcp.md`: Streamable HTTP connection and credential rules.
- `docs/agent.md`: expected agent behavior (permissions, idempotency, polling).
- `docs/resources.md`: canonical URLs for OpenAPI, manifest, `llms.txt`, go-live.

## Install

### Grok Build

```bash
grok plugin marketplace add https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin.git
grok plugin install freelaw-studio
```

In Grok (chat), add a custom connector at
`https://app.freelaw.ai/api/agent/mcp` with no Authorization header.

### Gemini CLI

```bash
gemini extensions install https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin
```

GitHub install reads `gemini-extension.json` at the repo root.

### Codex

```bash
codex plugin marketplace add https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin.git
codex plugin add freelaw-studio@freelaw-studio
```

The same directory can be pointed at by any Agent Plugins-compatible host.
Install, auth, and permissions stay host-managed.

### Manual

Clone the repo and point the host at `plugins/freelaw-studio/`. Do not copy
tokens into the checkout or the plugin config file.

## First connection

1. Read [`docs/agent.md`](docs/agent.md) and the [public docs](https://freelaw.ai/developers).
2. Configure remote MCP. Grok/Claude/Codex use [`.mcp.json`](plugins/freelaw-studio/.mcp.json) (`type: http`). Agent Plugins / Cursor use [`mcp.json`](plugins/freelaw-studio/mcp.json) (`type: streamable-http`). Same server.
3. Complete OAuth 2.1 + PKCE on the host. Never paste `flk_`, cookies, or refresh tokens into chat.
4. Run `/conectar` or `office.permissions.describe` before any read or write.
5. Smoke-test and keep `X-Correlation-ID` without storing sensitive data.

The MCP file deliberately has no `X-API-Key`. The host must supply the
credential through OAuth or a secret store. The key must never enter a prompt,
commit, or log.

## Skills and commands

Skills: `studio` (router), `delegacoes`, `peticoes`, `processos`, `clientes`, `prazos`, `publicacoes`, `documentos`.

Commands: `/conectar`, `/permissoes`, `/os`, `/peticao`, `/prazos`, `/intimacoes`.

## Product boundary

This package only reaches the public Freelaw Studio surface at
`app.freelaw.ai/api/agent/*`. It does not provide admin, internal operations,
or data outside the authenticated office.

License: MIT.
