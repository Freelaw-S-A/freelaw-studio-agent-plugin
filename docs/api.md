# Freelaw Studio public API

The public API is the HTTP contract for client and integrator workflows in the
Freelaw Studio. The server scopes every authenticated request to the office
represented by the credential.

## Canonical resources

| Resource | URL |
| --- | --- |
| Human documentation | <https://freelaw.ai/developers> |
| OpenAPI 3.1 | <https://app.freelaw.ai/api/agent/openapi> |
| Live action catalog | <https://app.freelaw.ai/api/agent/list> |
| Agent instructions | <https://freelaw.ai/developers/agent-instructions.md> |
| Go-live checklist | <https://freelaw.ai/developers/go-live.json> |
| Machine context | <https://freelaw.ai/llms.txt> |

## Authentication

Use a host-managed `X-API-Key` or the OAuth flow documented at
<https://freelaw.ai/developers/oauth>. A token belongs in a secret manager or
the host's protected connection settings, never in this repository, a prompt,
or a log.

The first authenticated call should be:

```bash
curl -sS https://app.freelaw.ai/api/agent/office.permissions.describe \
  -H 'X-API-Key: flk_...' \
  -H 'Accept: application/json'
```

Then discover the actions allowed for that token:

```bash
curl -sS https://app.freelaw.ai/api/agent/list \
  -H 'X-API-Key: flk_...' \
  -H 'Accept: application/json'
```

Treat `requiredScopes` and `inputSchema` from the live response as the source
of truth. The catalog can vary by credential and may evolve independently of
the plugin release.

## Workflow shape

For a service request, the safe sequence is:

1. Discover permissions and the live catalog.
2. Resolve real `serviceType` and `legalArea` IDs with `office.catalog.list`.
3. Create the service with `office.delegations.create` and a unique
   `idempotencyKey`.
4. Upload documents using `office.documents.createUploadUrl`, then call
   `office.documents.confirmUpload`.
5. Start `office.petitions.generate` only after required documents are confirmed.
6. Poll `office.petitions.status` according to `nextPollAfterSeconds`.
7. Download the result with `office.petitions.download` only after it is ready.

Do not construct IDs from examples, retry non-idempotent writes blindly, or
claim a completed service from an HTTP request that only created a workflow.

## Errors and support

Handle HTTP status, the structured error code, and `X-Correlation-ID` together.
For `429`, respect `Retry-After`; for asynchronous workflows, respect the
workflow's polling interval. When escalating, include the action, endpoint,
timestamp, environment, status, correlation ID, and sanitized payload shape—
not tokens, PII, or document contents.
