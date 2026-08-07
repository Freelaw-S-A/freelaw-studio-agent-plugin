# Freelaw Studio Agent Plugin

Pacote público para conectar agentes e assistentes ao Freelaw Studio com a
API pública e o MCP remoto. Ele foi desenhado para clientes, integradores e
equipes jurídicas; não contém capacidades administrativas.

## O que está neste repositório

- `plugins/freelaw-studio/`: pacote portátil no padrão [Agent Plugins](https://agent-plugins.org/), com a skill pública e a configuração do MCP.
- `docs/api.md`: contrato HTTP, autenticação e descoberta dinâmica de ações.
- `docs/mcp.md`: conexão Streamable HTTP e regras de credenciais.
- `docs/agent.md`: comportamento esperado do agente, incluindo permissões, idempotência e polling.
- `docs/resources.md`: URLs canônicas para OpenAPI, manifest, `llms.txt` e go-live.

## Instalação

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
2. Configure o MCP remoto de [`plugins/freelaw-studio/mcp.json`](plugins/freelaw-studio/mcp.json).
3. Gere ou autorize uma credencial no Freelaw Studio com os escopos mínimos necessários.
4. Execute descoberta de permissões e ações antes de tentar uma leitura ou escrita.
5. Faça o smoke test e registre `X-Correlation-ID` sem armazenar dados sensíveis.

O arquivo MCP deliberadamente não contém `X-API-Key`. O host deve fornecer a
credencial por um mecanismo seguro, como OAuth ou secret store. A chave nunca
deve entrar no prompt, em commits ou em logs.

## Limite do produto

Este pacote acessa somente a superfície pública do Freelaw Studio em
`app.freelaw.ai/api/agent/*`. Ele não fornece acesso a administração,
operações internas ou dados fora do escritório autenticado. O SDK/npm é uma
possível evolução separada; a integração atual usa HTTP e MCP como contratos
canônicos.
