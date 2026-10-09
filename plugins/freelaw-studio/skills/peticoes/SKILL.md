---
name: peticoes
description: "Start, poll and download a petition generation workflow explicitly requested in Freelaw Studio, or retrieve a document already generated there. Do not activate for general drafting, editing or legal research in the host conversation."
---

# Petições

For drafting in this conversation, use the host model. Call Freelaw generation
only for an explicitly requested Studio generation service, after confirming the
OS and required fields; do not implicitly spend AI credits to answer a question.

1. Confirm the OS (`delegationId`) and that supporting documents are uploaded and confirmed.
2. If `office.petitions.workflow.inspect` is available, call it before generation and explain its preflight, open issues and next safe step. Do not invent this action when it is absent from the live catalog.
3. Confirm that the user chose Freelaw generation, then confirm the OS, `documentType` (`initial_petition` | `defense` | `appeal` | `memo`) and any `additionalInstructions`.
4. Describe only the entitlement, quota, balance or cost returned by `office.usage.get` or the generation response. If the server returns `insufficient_ai_credits` or another entitlement block, explain the block and stop; do not encourage a purchase or follow a checkout URL.
5. Start `office.petitions.generate` with only fields in its current schema. If it returns `approvalUrl`, present that continuation and wait. Use an approval or reservation field only when the server returns it or the live schema exposes it, preserving the exact value; do not invent one or an unsupported `idempotencyKey`. Resume only as the server directs, with the same target and exact inputs.
6. Poll `office.petitions.status` only after the generation was submitted, using `nextPollAfterSeconds` or `Retry-After`. Never busy-loop or restart generation while the same workflow is pending.
7. Call `office.petitions.download` only when `ready=true` and use a supported format: `markdown` | `docx` | `pdf`.
8. For pieces already generated, use `office.aiDocuments.list` / `get` instead of starting a new workflow.
9. Diagnose a stuck generation with `office.petitions.status` plus `X-Correlation-ID`. Report `workflow_disabled`, missing preflight, open issues, quota exhaustion, unsupported actions and unknown states distinctly.

Treat generated text as draft work product. Disclose AI assistance. A qualified lawyer must review before filing or sending to a client. Never present the draft as exclusively human-authored.
