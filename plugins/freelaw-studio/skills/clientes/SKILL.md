---
name: clientes
description: "Find, create and update client records in a connected Freelaw Studio office. Use for buscar cliente, cadastrar cliente or atualizar ficha in Freelaw. Do not activate for general client advice. Use office record UUIDs; never request government identifiers."
---

# Clientes

1. Search with `office.clients.list` before creating.
2. Read a ficha with `office.clients.get` using the record UUID returned by name lookup.
3. Create or update only after the user confirms the name and other permitted details. Never request, infer or send government identifiers; use existing record UUIDs for client references.
4. Confirm writes; then re-read the created/updated record.
5. Do not log private client details in traces.
