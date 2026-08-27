# Changelog

## 0.3.2 - 2026-08-27

- Stop the per-turn discovery ritual (`permissions.describe` + `tools/list`) in
  agent instructions. Prefer `office.dailySummary.get` for "what do I have today"
  and call `office.catalog.list` only when creating a service (OS).

## 0.3.1 - 2026-08-25

- LICENSE copied into `plugins/freelaw-studio/` so the xAI catalog pin is self-contained.
- English reviewer README with explicit network endpoints, credentials, and host matrix.
- Plugin-path `SECURITY.md`. Brand-scoped keywords (`freelaw`, `freelaw studio`, `freelaw mcp`).

## 0.3.0 - 2026-08-25

- Grok Build marketplace (`.grok-plugin/`) and `.mcp.json` `type: http`.
- Gemini CLI extension at repo root (`gemini-extension.json` + `GEMINI.md`) with OAuth enabled.
- Skills for delegacoes, peticoes, processos, clientes, prazos, publicacoes and documentos.
- Slash commands: conectar, os, permissoes, peticao, prazos, intimacoes.
- Dual MCP config: Agent Plugins `mcp.json` stays `streamable-http`; Grok/Claude/Codex `.mcp.json` uses `http`.

## 0.2.0 - 2026-08-25

- Added the explicit Claude plugin manifest.
- Added direct privacy, terms, and support links to the package metadata.
- Added human-review and AI-disclosure guardrails for legal work product.
- Added reviewer guidance for synthetic data and least-privilege testing.
