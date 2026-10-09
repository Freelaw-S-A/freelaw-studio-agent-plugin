---
name: delegacoes
description: "Create and follow services (OS / delegações) in a connected Freelaw Studio office, approve deliveries, request revisions or use its provider thread. Do not activate for drafting in chat without a request to create or manage a Freelaw service."
---

# Delegações (OS)

1. Use the host's permission-filtered catalog. Call `office.permissions.describe` only when the connection or write scope is unclear.
2. Resolve `serviceType` and `legalArea` with `office.catalog.list`. Never invent UUIDs.
3. Confirm the client (`office.clients.list` / `get`) and process (`office.processes.list` / `get`) before creating.
4. For a human delegation, ask the user, then confirm: title, polo (`autor`/`reu` when required), prazo fatal, urgência/`deliveryType`, `mode: human`, and `assignment` (`member`|`team`|`freelaw`). Use the petition workflow for explicitly requested Freelaw AI generation; do not force it through a human OS.
5. Create with `office.delegations.create`. Required fields: `title`, `serviceType`, `legalArea`. Send only fields in the live schema. Use one stable UUID `idempotencyKey` for the logical request and reuse it on a safe retry; never generate a different key per attempt.
6. Accept OS numbers as `4216692` or `OS-4216692` on later reads.
7. Follow `nextAction` / `nextActions` from the create response. Do not jump to petition generate.
8. Upload supporting files with `office.documents.createUploadUrl` then `office.documents.confirmUpload`.
9. Follow status with `office.delegations.get` / `list` / `stats`.
10. Lifecycle writes (`approve`, `requestRevision`, `rate`, `sendMessage`, `requestReplacement`) need explicit user confirmation of the target OS.

Surface only the service availability, quota and cost the server returns. If it
returns a quota/entitlement block, stop without opening a checkout flow or
repeating the request. If it returns `approvalUrl`, present that continuation,
wait for completion, then resume only when instructed with the same target,
exact inputs and idempotency key. Use an approval or reservation field only
when the server returns it or the live schema exposes it, preserving the exact
value; never invent one.

A create response is not a finished petition. Report the OS id and the next verified step.
