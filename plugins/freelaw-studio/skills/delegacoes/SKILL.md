---
name: delegacoes
description: "Create and follow services (OS / delegações) in a connected Freelaw Studio office, approve deliveries, request revisions or use its provider thread. Do not activate for drafting in chat without a request to create or manage a Freelaw service."
---

# Delegações (OS)

1. Use the host's permission-filtered catalog. Call `office.permissions.describe` only when the connection or write scope is unclear.
2. Resolve `serviceType` and `legalArea` with `office.catalog.list`. Never invent UUIDs.
3. Confirm the client (`office.clients.list` / `get`) and process (`office.processes.list` / `get`) before creating.
4. Ask the user, then confirm: title, polo (`autor`/`reu` when required), prazo fatal, urgência/`deliveryType`, `mode` (`human`|`ai`), `assignment` (`member`|`team`|`freelaw`).
5. Create with `office.delegations.create`. Required fields: `title`, `serviceType`, `legalArea`. Always send a unique `idempotencyKey`.
6. Accept OS numbers as `4216692` or `OS-4216692` on later reads.
7. Follow `nextAction` / `nextActions` from the create response. Do not jump to petition generate.
8. Upload supporting files with `office.documents.createUploadUrl` then `office.documents.confirmUpload`.
9. Follow status with `office.delegations.get` / `list` / `stats`.
10. Lifecycle writes (`approve`, `requestRevision`, `rate`, `sendMessage`, `requestReplacement`) need explicit user confirmation of the target OS.

A create response is not a finished petition. Report the OS id and the next verified step.
