---
name: publicacoes
description: "Read official-diary publications and intimações recorded in a connected Freelaw Studio office, mark them read or prepare client notices. Do not activate for general questions about publications or service of process."
---

# Publicações

1. `office.publications.list` / `get` for unread official-diary items.
2. `markRead` only after the user confirms the publication.
3. `createTask` to turn an intimação into office work.
4. `clientNotice` prepares a client-facing message from structured facts. It never sends WhatsApp and never returns the client's phone. The lawyer reviews and sends in Studio.
5. Do not forward lawyer summaries (`summary_markdown`) to clients.
