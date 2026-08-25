---
name: clientes
description: Find and maintain Freelaw Studio clients. Use to buscar cliente, cadastrar cliente, or atualizar ficha. Never invent CPF/CNPJ.
---

# Clientes

1. Search with `office.clients.list` before creating.
2. Read a ficha with `office.clients.get`.
3. Create or update only after the user confirms name and tax id. Never invent CPF/CNPJ.
4. Confirm writes; then re-read the created/updated record.
5. Do not log tax ids, phones, or addresses in traces.
