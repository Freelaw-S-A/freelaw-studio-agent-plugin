---
name: freelaw-studio
description: Use for client-facing Freelaw Studio workflows through the public API or MCP, including clients, processes, tasks, delegations, documents, petitions, and agent integrations. Do not use for internal administration.
---

# Freelaw Studio

This is the public client-facing profile for connecting an agent to the
Freelaw Studio API and MCP. It is intentionally limited to organization-scoped
public actions.

## Start with the public contract

- Read `https://freelaw.ai/developers` and `https://freelaw.ai/llms.txt` when the
  host permits network access.
- Use `https://app.freelaw.ai/api/agent/openapi` for the HTTP contract and
  `https://app.freelaw.ai/api/agent/list` for the live action catalog.
- Use `https://app.freelaw.ai/api/agent/mcp` for Streamable HTTP MCP.
- Do not infer private endpoints, schemas, roles, or capabilities from this package.

## Safe agent behavior

1. Establish the user, office, requested outcome, and whether the action is a read or write.
2. Obtain a host-managed credential with the minimum required scopes. Never ask
   the user to paste a secret into a prompt or commit it to a repository.
3. Call `office.permissions.describe` first when using an authenticated key.
4. Call `GET /api/agent/list` or MCP `tools/list` and use the live `inputSchema`.
5. Call `office.catalog.list` before creating a service; never invent catalog UUIDs.
6. Before a write, confirm the target and required fields. Use an explicit
   `idempotencyKey` for retriable mutations.
7. For documents, use the signed upload URL and confirm the upload before
   starting downstream generation.
8. For asynchronous generation, respect `nextPollAfterSeconds` and
   `Retry-After`; do not busy-loop or report success before a terminal response.
9. Preserve `X-Correlation-ID`, action, status, timestamp, and sanitized error
   context for support. Do not log PII, tokens, or document contents.
10. Report what was observed and verified separately from what was requested or attempted.

## Scope boundary

This profile has no internal administration capability. Do not use it to access
administrative dashboards, internal operations, private databases, or routes
outside `https://app.freelaw.ai/api/agent/*`. If the user asks for an internal
operation, explain that the public client profile cannot perform it and ask for
the appropriate internal workflow owner.
