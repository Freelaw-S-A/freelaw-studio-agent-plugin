---
name: peticoes
description: Generate, poll, and download Freelaw Studio petitions. Use when the user asks to gerar petição, status da peça, or baixar documento gerado.
---

# Petições

1. Confirm the OS (`delegationId`) and that supporting documents are uploaded and confirmed.
2. Start `office.petitions.generate` only after the user confirms the OS and `documentType`: `initial_petition` | `defense` | `appeal` | `memo`.
3. Poll `office.petitions.status` using `nextPollAfterSeconds`. Never busy-loop.
4. Call `office.petitions.download` only when `ready=true`.
5. If the API returns `insufficient_ai_credits`, tell the user to add credits in Studio. Do not retry in a loop.
6. For pieces already generated, use `office.aiDocuments.list` / `get` instead of starting a new workflow.
7. A stuck generation is diagnosed with `office.petitions.status` plus `X-Correlation-ID` for support. There is no `workflow.inspect` action.

Treat generated text as draft work product. Disclose AI assistance. A qualified lawyer must review before filing or sending to a client. Never present the draft as exclusively human-authored.
