# Security

Do not report tokens, customer data, document contents, cookies, or other
secrets in a public issue. The plugin itself is designed to contain no
credentials.

Network surface (plugin files only):

- `https://app.freelaw.ai/api/agent/mcp`
- `https://app.freelaw.ai/oauth/register` and `/oauth/token`
- `https://app.freelaw.ai/.well-known/*`
- `https://app.freelaw.ai/api/agent/*`

No hooks, no install scripts, no local binaries, no telemetry.

For an integration incident, preserve `X-Correlation-ID` without logging PII and
use the support channel in [`docs/api.md`](docs/api.md) or
https://freelaw.ai/developers/support.json.
