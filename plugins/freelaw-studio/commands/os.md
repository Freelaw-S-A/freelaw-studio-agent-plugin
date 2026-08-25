---
description: Abrir ou acompanhar uma OS / delegação no Freelaw Studio.
---

Ajude com uma OS no Freelaw Studio. {{args}}

1. Se for criar: descubra catálogo, cliente e processo reais antes de office.delegations.create.
2. Campos obrigatórios: title, serviceType, legalArea (UUIDs do catálogo). Use idempotencyKey único.
3. Confirme alvo, tipo de serviço e área jurídica com o usuário.
4. Se for acompanhar: office.delegations.get / list e reporte só o que a API devolveu.
5. Escritas de ciclo de vida exigem confirmação explícita da OS.
6. Criar OS não é gerar petição.
