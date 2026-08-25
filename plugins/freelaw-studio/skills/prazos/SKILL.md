---
name: prazos
description: List, validate, and turn Freelaw Studio legal deadlines into tasks. Use for prazos, prazo fatal, or criar tarefa de prazo. High liability — never fabricate dates.
---

# Prazos

1. Read `office.deadlines.list` / `get` for the process or office.
2. Validate before creating work: `office.deadlines.validate` then `validateAndCreateTask` only with explicit confirmation.
3. Lifecycle (`adjust`, `declareFiled`, `archive`, `reject`) needs the target deadline confirmed by the user.
4. Never invent a fatal date, tribunal count, or weekend rule. If the API cannot compute it, say so.
5. Pair with `office.publications.*` when the deadline comes from an intimação.
