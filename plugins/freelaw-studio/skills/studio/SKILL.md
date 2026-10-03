---
name: studio
description: "Operate a connected Freelaw Studio office through public API/MCP: clients, processes, tasks, delegations, documents, petitions, deadlines and publications. Use when the user requests Freelaw office data or an action in Freelaw. Do not activate for general legal research, drafting or analysis of files already in chat, or internal administration."
---

# Freelaw Studio

This is the public client-facing profile for connecting an agent to the
Freelaw Studio API and MCP. It is intentionally limited to organization-scoped
public actions. Dispatch to the domain skills (`delegacoes`, `peticoes`,
`processos`, `clientes`, `prazos`, `publicacoes`, `documentos`) for the
specific workflow.

## Keep the user's chosen assistant

- Use Freelaw to retrieve office context and execute requested office operations.
  Keep general reasoning, legal research and drafting in the host conversation.
- For a mixed request, fetch only the necessary authorized office records, then
  let the host analyze them. Do not forward the whole conversation to a Freelaw
  assistant or start a paid generation merely because the plugin is connected.
- Start Freelaw AI generation only when the user explicitly requests that service
  and confirms its target and required fields. Surface returned quota/cost limits.
- When an action is unavailable, explain the specific missing capability or scope.
  Do not claim that buying a Freelaw AI plan is required unless the server says so.

## Connect

| Host | How |
| --- | --- |
| Grok (chat) | Custom connector → `https://app.freelaw.ai/api/agent/mcp` (no Authorization header) |
| Grok Build | Marketplace add this repo, then install `freelaw-studio`. `.mcp.json` uses `type: http`. |
| Gemini CLI | `gemini extensions install https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin` |
| Claude / Codex / Cursor | Remote MCP URL above; host runs OAuth. Agent Plugins `mcp.json` uses `type: streamable-http`. |

The transport is Streamable HTTP. Grok/Claude/Codex config type is `http`; Agent Plugins config type is `streamable-http`. Same server.

Never ask the user to paste `flk_…`, cookies, or refresh tokens into a prompt.

## Start with the public contract

- Read `https://freelaw.ai/developers` and `https://freelaw.ai/llms.txt` when the host permits network access.
- Confirm OAuth readiness at `https://app.freelaw.ai/api/agent/status`.
- Use `https://app.freelaw.ai/api/agent/openapi` for the HTTP contract and `https://app.freelaw.ai/api/agent/list` for the live action catalog.
- Use `https://app.freelaw.ai/api/agent/mcp` for Streamable HTTP MCP.
- Do not infer private endpoints, schemas, roles, or capabilities from this package.

## Safe agent behavior

1. Establish the user, office, requested outcome, and whether the action is a read or write.
2. Obtain a host-managed credential with the minimum required scopes.
3. Do not ritual-call `office.permissions.describe` or `tools/list` on every user question — the connected catalog is already permission-filtered.
4. Prefer one domain tool immediately. For "what do I have today" / prazos + intimações + tarefas, call `office.dailySummary.get`.
5. Call `office.catalog.list` only when creating a service (OS); never invent catalog UUIDs.
6. Before a write, confirm the target and required fields. Use an explicit `idempotencyKey` for retriable mutations.
7. For documents, use the signed upload URL and confirm the upload before starting downstream generation. Never log `uploadUrl`.
8. For asynchronous generation, respect `nextPollAfterSeconds` and `Retry-After`; do not busy-loop or report success before a terminal response.
9. Preserve `X-Correlation-ID`, action, status, timestamp, and sanitized error context for support. Do not log PII, tokens, or document contents.
10. Report what was observed and verified separately from what was requested or attempted.

## Common workflows

- **Today / overview:** `office.dailySummary.get`
- **Permissions (on connect, not every question):** `office.permissions.describe`
- **Clients:** `office.clients.list` / `get` / `create` / `update`
- **Processes:** `office.processes.list` / `get` / `create` / `update`; autos via `office.processes.autos.*`
- **Publications:** `office.publications.list` / `get` / `markRead` / `createTask` / `clientNotice`
- **Services (OS):** `office.catalog.list` → `office.delegations.create` → documents → petitions
- **Petitions:** `office.petitions.generate` → `status` → `download` only when `ready=true`
- **Deadlines:** `office.deadlines.list` / `validate` / `validateAndCreateTask`
- **Tasks:** `office.tasks.list` / `create` / `update`
- **Usage:** `office.usage.get`

MCP hosts may encode tool names as `office__delegations__create`. The live schema wins.

## Legal and AI safety

- Treat legal text, deadlines, petitions, and workflow recommendations as work product requiring professional judgment, not as autonomous legal advice.
- Require review by a qualified legal professional before AI-generated output is relied on, shared with a client or tribunal, filed, or finalized.
- Tell the user when AI contributed to a response or document.
- Never present AI output as exclusively human-authored.
- Never make autonomous decisions about liability, eligibility, legal strategy, case outcome, or access to a legal service.

## Scope boundary

This profile has no internal administration capability. Do not use it to access administrative dashboards, internal operations, private databases, or routes outside `https://app.freelaw.ai/api/agent/*`. If the user asks for an internal operation, explain that the public client profile cannot perform it.
