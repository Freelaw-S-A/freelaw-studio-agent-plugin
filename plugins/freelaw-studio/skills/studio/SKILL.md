---
name: studio
description: "Operate a connected Freelaw Studio office through public API/MCP: clients, processes, tasks, delegations, documents, petitions, jurisprudence, deadlines and publications. Use when the user requests Freelaw office data or an action in Freelaw. Do not activate for general legal research, drafting or analysis of files already in chat, or internal administration."
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

## Complete client journeys

Start with the outcome, use the permission-filtered actions that are actually
available, and stop at a useful state instead of repeating a blocked call.

1. **Write a petition.** Draft with the host model by default. When the user
   explicitly chooses Freelaw generation, resolve the OS, inspect
   `office.petitions.workflow.inspect` if that action is available, explain any
   preflight or open-issue gate, confirm the document type and instructions,
   then generate, poll and download as described by `peticoes`.
2. **Delegate a piece.** Resolve catalog values, confirm the OS inputs and use
   `office.delegations.create` for a human service. Follow the returned
   `nextAction` / `nextActions`, attach confirmed documents, and report the OS
   state. Do not route a request for AI generation through a human delegation.
3. **Research jurisprudence.** Call `office.jurisprudence.search` with the
   user's query and filters. Present source/provenance and verified results. If
   the response creates a job, follow its `job.id`, `status` and `nextAction`
   with `office.jurisprudence.search.status`; do not restart the same search.
4. **Create a task.** Read existing tasks when duplication is possible. Confirm
   title, assignee, due date and board when relevant, then call
   `office.tasks.create`. Reuse a stable UUID `idempotencyKey` for a retry only
   when the current schema exposes that field. Report unresolved links and the
   returned task/deep link instead of claiming success from the request alone.
5. **Handle a publication.** Read the item, request
   `office.publications.analyze`, poll `analysisStatus` when it is processing,
   and present the returned analysis. Use `scheduleDeadline` for its deadline,
   `createTask` for office work, and `clientNotice` only to prepare a message;
   it does not send anything.

For a daily overview, call `office.dailySummary.get` and show returned tasks,
deadlines and publications with their dates and states. For document context,
use `office.documents.search` when available; upload files only for a specified
OS through the confirmed two-step upload flow.

## Availability, cost and continuations

- Keep host drafting/reasoning separate from an explicitly requested Freelaw
  service. Before a potentially metered operation, use `office.usage.get` when
  available and describe only the entitlement, quota, balance or charge the
  server returns. Do not invent prices, call an unknown state free/unlimited,
  or claim a subscription is required without a server result.
- If the server reports an exhausted entitlement or quota, explain that the
  operation is unavailable under the returned state and stop. Do not encourage
  a purchase, open a checkout flow, or retry the same blocked action.
- Distinguish `processing`, `approval_required`, `unsupported`, `unavailable`,
  `quota_exhausted`, `failed` and `completed` when the response supports them.
  Follow returned polling intervals and next actions; otherwise report the
  unknown state and the missing capability.
- If a response returns `approvalUrl`, present that URL as the server-provided
  continuation and wait for the user to complete it. Retry or resume only when
  the server says to, preserving the same target, exact inputs and stable
  idempotency key when the action schema supports one. Use an approval,
  reservation or billing field only when the server returns it or the live
  schema exposes it, preserving the exact value; never invent one.

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
6. Before a write, confirm the target and required fields. Send only fields in the live schema; use a stable `idempotencyKey` only when that action exposes one.
7. For documents, use the signed upload URL and confirm the upload before starting downstream generation. Never log `uploadUrl`.
8. For asynchronous generation, respect `nextPollAfterSeconds` and `Retry-After`; do not busy-loop or report success before a terminal response.
9. Preserve `X-Correlation-ID`, action, status, timestamp, and sanitized error context for support. Do not log PII, tokens, or document contents.
10. Report what was observed and verified separately from what was requested or attempted.

## Common workflows

- **Today / overview:** `office.dailySummary.get`
- **Permissions (on connect, not every question):** `office.permissions.describe`
- **Clients:** `office.clients.list` / `get` / `create` / `update`
- **Processes:** `office.processes.list` / `get` / `create` / `update`; autos via `office.processes.autos.*`
- **Publications:** `office.publications.list` / `get` / `analyze` / `analysisStatus` / `scheduleDeadline` / `createTask` / `clientNotice` / `markRead`
- **Services (OS):** `office.catalog.list` → `office.delegations.create` → documents → petitions
- **Petitions:** optional `office.petitions.workflow.inspect` → `generate` → `status` → `download` only when `ready=true`
- **Jurisprudence:** `office.jurisprudence.search` → `search.status` only when a job is returned
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
