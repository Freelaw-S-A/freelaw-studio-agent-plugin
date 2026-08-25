---
name: processos
description: Look up and maintain Freelaw Studio lawsuit files (processos) and tribunal autos downloads. Use for listar processos, ficha do processo, or baixar autos.
---

# Processos

- Read first: `office.processes.list` / `get`.
- Create or update only after confirming a real `clientId` and a unique CNJ process number. Never invent CNJ, court codes, vara, or parties.
- Autos: `office.processes.autos.download` or `download_many`, then poll `office.processes.autos.status` and fetch `artifacts`. Do not log signed artifact URLs.
- Inspect a pipeline with `office.processes.pipeline.inspect` instead of inventing tribunal state.
- Related reads on the same file: `office.publications.*` and `office.deadlines.*`.
