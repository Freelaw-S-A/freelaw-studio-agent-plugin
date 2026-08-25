# Freelaw Studio

Pacote cliente do Freelaw Studio. Skills, comandos e MCP são públicos;
credenciais, escopos e autorização ficam sob controle do host e do escritório
autenticado.

## Hosts

- **Grok Build:** marketplace deste repositório, plugin `freelaw-studio`. `.mcp.json` usa `type: http`.
- **Grok chat:** conector customizado `https://app.freelaw.ai/api/agent/mcp`.
- **Gemini CLI:** `gemini extensions install` na raiz do repositório, ou `--path plugins/freelaw-studio`.
- **Claude / Codex / Cursor:** MCP remoto; OAuth no host.

## Segurança e uso jurídico

- O servidor é limitado às ações públicas e escopadas da organização autenticada.
- O host deve usar OAuth 2.1 com PKCE ou um armazenamento seguro de credenciais; nunca
  peça ao usuário para colar tokens, cookies ou chaves em um prompt.
- Antes de qualquer escrita, upload, geração, envio ou exclusão, confirme o alvo e o
  efeito exato com o usuário.
- O plugin não fornece aconselhamento jurídico autônomo nem toma decisões jurídicas
  de alto impacto. Um profissional jurídico habilitado deve revisar qualquer saída
  gerada por IA antes de ser usada, compartilhada, protocolada ou finalizada.
- Informe ao usuário quando uma resposta ou documento tiver sido produzido com auxílio
  de IA. Nunca apresente saída de IA como se fosse trabalho exclusivamente humano.

Não envie dados reais de clientes para homologação. Use uma organização de teste com
dados sintéticos e escopos mínimos.

## Privacidade e suporte

- [Política de Privacidade](https://freelaw.ai/politica-de-privacidade)
- [Termos de Uso](https://freelaw.ai/termos-de-uso)
- [Suporte](https://freelaw.ai/developers/support.json)

Leia a documentação na raiz do repositório:

- [`docs/api.md`](../../docs/api.md)
- [`docs/mcp.md`](../../docs/mcp.md)
- [`docs/agent.md`](../../docs/agent.md)
