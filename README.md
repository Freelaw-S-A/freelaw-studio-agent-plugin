# Freelaw Studio Agent Plugin

Pacote público para conectar agentes e assistentes ao Freelaw Studio com a
API pública e o MCP remoto. Ele foi desenhado para clientes, integradores e
equipes jurídicas; não contém capacidades administrativas.

## O que está neste repositório

- `plugins/freelaw-studio/`: pacote portátil no padrão [Agent Plugins](https://agent-plugins.org/), com skills, comandos e a configuração do MCP.
- `gemini-extension.json` e `GEMINI.md` na raiz: instalação direta no Gemini CLI.
- `.grok-plugin/marketplace.json`: marketplace local para o Grok Build.
- `docs/api.md`: contrato HTTP, autenticação e descoberta dinâmica de ações.
- `docs/mcp.md`: conexão Streamable HTTP e regras de credenciais.
- `docs/agent.md`: comportamento esperado do agente, incluindo permissões, idempotência e polling.
- `docs/resources.md`: URLs canônicas para OpenAPI, manifest, `llms.txt` e go-live.

## Instalação

### Grok Build

```bash
grok plugin marketplace add https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin.git
grok plugin install freelaw-studio
```

No Grok (chat), adicione um conector customizado com
`https://app.freelaw.ai/api/agent/mcp` e sem header de Authorization.

### Gemini CLI

```bash
gemini extensions install https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin
```

A instalação pelo GitHub lê `gemini-extension.json` na raiz deste repositório.

### Codex

```bash
codex plugin marketplace add https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin.git
codex plugin add freelaw-studio@freelaw-studio
```

O mesmo diretório pode ser apontado por hosts compatíveis com o padrão Agent
Plugins. A instalação, autenticação e permissões continuam sendo gerenciadas
pelo host.

### Manual

Clone o repositório e aponte o host para
`plugins/freelaw-studio/`. Não copie tokens para o checkout nem para o arquivo
de configuração do plugin.

## Primeira conexão

1. Leia [`docs/agent.md`](docs/agent.md) e a [documentação pública](https://freelaw.ai/developers).
2. Configure o MCP remoto. Grok/Claude/Codex usam [`.mcp.json`](plugins/freelaw-studio/.mcp.json) (`type: http`). Agent Plugins / Cursor usam [`mcp.json`](plugins/freelaw-studio/mcp.json) (`type: streamable-http`). O servidor é o mesmo.
3. Complete OAuth 2.1 + PKCE no host. Nunca cole `flk_`, cookies ou refresh tokens no chat.
4. Execute `/conectar` ou `office.permissions.describe` antes de qualquer leitura ou escrita.
5. Faça o smoke test e registre `X-Correlation-ID` sem armazenar dados sensíveis.

O arquivo MCP deliberadamente não contém `X-API-Key`. O host deve fornecer a
credencial por um mecanismo seguro, como OAuth ou secret store. A chave nunca
deve entrar no prompt, em commits ou em logs.

## Skills e comandos

Skills: `studio` (roteador), `delegacoes`, `peticoes`, `processos`, `clientes`, `prazos`, `publicacoes`, `documentos`.

Comandos: `/conectar`, `/permissoes`, `/os`, `/peticao`, `/prazos`, `/intimacoes`.

## Limite do produto

Este pacote acessa somente a superfície pública do Freelaw Studio em
`app.freelaw.ai/api/agent/*`. Ele não fornece acesso a administração,
operações internas ou dados fora do escritório autenticado. O SDK/npm é uma
possível evolução separada; a integração atual usa HTTP e MCP como contratos
canônicos.
