---
name: publicacoes
description: "Read official-diary publications and intimações recorded in a connected Freelaw Studio office, mark them read or prepare client notices. Do not activate for general questions about publications or service of process."
---

# Publicações

1. Use `office.publications.list` / `get` for unread official-diary items. For "a última", prefer `latest: true` on `office.publications.analyze` instead of choosing by list position.
2. Call `office.publications.analyze` for the complete analysis. When it returns processing, poll `office.publications.analysisStatus` for the same publication; do not submit another analysis request.
3. Use `office.publications.scheduleDeadline` for deadline calculation and persistence. When it returns an uncertain proposal, recap the exact date and confidence and obtain confirmation before retrying with `confirmedFatalDate`.
4. Use `office.publications.createTask` to turn the item into office work. Preserve `expectedUpdatedAt` when returned so a stale retry cannot overwrite a newer state.
5. Use `office.publications.clientNotice` to prepare a client-facing message from structured facts. It never sends WhatsApp and never returns the client's phone. The lawyer reviews and sends in Studio.
6. Call `office.publications.markRead` only after the user confirms the publication.
7. Do not forward lawyer summaries (`summary_markdown`) to clients.
