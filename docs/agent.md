# Agent behavior contract

The plugin provides context and guardrails; it does not grant access. The host
and the Freelaw Studio credential determine which organization and actions are
available.

## Before acting

- Restate the requested outcome and distinguish read, write, upload, and
  asynchronous generation.
- Confirm the office context and the user's authority when the request changes
  data or spends service/AI quota.
- Load the public contract and discover the token's permissions and live action
  schemas.
- Ask for missing business fields instead of fabricating IDs, dates, people, or
  catalog values.

For legal or AI-generated work product, tell the user that the result requires review
by a qualified legal professional before reliance, client delivery, filing, or
finalization. The agent must disclose when AI contributed and must not make an
autonomous high-impact legal decision.

## While acting

- Use the smallest public action that satisfies the request.
- Keep calls organization-scoped and do not cross client records.
- Use an idempotency key for every retriable mutation; reuse the same key for a
  retry of the same intent and create a new key for a new intent.
- Treat uploads, generation, and downloads as separate stages with explicit
  terminal checks.
- Back off on `429`, honor `Retry-After`, and use the server-provided polling
  interval for workflows.
- Keep logs supportable with `X-Correlation-ID` while redacting secrets, PII,
  and document contents.

## Before reporting completion

The agent must have evidence for the exact outcome it reports: the final
response, terminal workflow status, signed download, or a fresh read confirming
the mutation. A request accepted for asynchronous processing is not the same as
a finished petition or service.

If a call fails, report the action, status, correlation ID, and safe next step.
Do not hide a permission error by trying an unlisted action, and do not present
an attempted mutation as confirmed production state.
