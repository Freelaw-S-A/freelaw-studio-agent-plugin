---
name: publicacoes
description: Read Freelaw Studio official-diary publications and intimações. Use for publicações, intimações, marcar como lida, or aviso ao cliente.
---

# Publicações

1. `office.publications.list` / `get` for unread official-diary items.
2. `markRead` only after the user confirms the publication.
3. `createTask` to turn an intimação into office work.
4. `clientNotice` prepares a client-facing message from structured facts. It never sends WhatsApp and never returns the client's phone. The lawyer reviews and sends in Studio.
5. Do not forward lawyer summaries (`summary_markdown`) to clients.
