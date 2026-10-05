# Executable review kit

This opt-in kit validates fixture plans and runs the eight cases published in
the plugin review contract. It lives outside the installable package. Version
0.4.2, its release assets and provider submission facts remain unchanged.

Copy `docs/review-fixtures.example.json` for each campaign. Update its campaign,
all matching markers, creation and expiration dates. Retention is at most 30
days. The validator requires dedicated synthetic primary and foreign offices,
two primary clients, one process, two publications, one pending task and an
existing foreign client. References are symbolic and must belong to the same
office. The cleanup declaration requires a responsible operator, a dry run
after expiration, and preservation of audit history.

```sh
bun run review:plan --plan docs/review-fixtures.example.json
bun run review:run --simulate --plan docs/review-fixtures.example.json --output /tmp/freelaw-review-simulation.json
```

The example dates are illustrative and expire. Simulation executes the same
case predicates against an in-memory read adapter. It cannot establish account
provisioning, hosted authorization, native host behavior or submission readiness.
The task case stays blocked until an authenticated native host verifies approval
and recovery. If the deployed catalog does not advertise a UUID idempotency key
on `tasks.create` and read-only `tasks.getByIdempotencyKey`, its reason is
`task_idempotency_not_supported`; with both contracts it is `native_host_required`.
An already-consumed approval proposal is always rejected on replay. The
credential refusal case also needs a native host conversation. Neither case is
fabricated in simulation.

For live reads, first provision the dedicated synthetic fixtures through the
authorized product/operator process. This kit does not provision or delete data,
approve proposals, or create publications. Assign the pending task to the reviewer
with a due date today, and make the unread synthetic publication relevant to
today's overview. The overview must contain those attention fixtures; empty or
partially degraded summaries do not pass. There is no deadline fixture: this kit
does not prove legal deadline computation. Never use a shared CI account or a
real client office. Put actual IDs in a private JSON binding file with this shape:

```json
{
  "schemaVersion": 1,
  "offices": { "primary": "<primary office UUID>", "foreign": "<foreign office UUID>" },
  "fixtures": { "<each symbolic fixture key from the plan>": "<actual record UUID>" }
}
```

Use actual distinct UUIDs; angle-bracket placeholders are invalid. Keep the file
private with mode 0600. Supply separately authorized host-managed credentials
through `FREELAW_REVIEW_MCP_TOKEN`, `FREELAW_REVIEW_FOREIGN_MCP_TOKEN` and
`FREELAW_REVIEW_READ_ONLY_MCP_TOKEN` in the execution environment. Never put
credentials in the plan, command arguments, chat, report or repository.

```sh
bun run review:run --plan /private/review-plan.json --bindings /private/review-bindings.json --output /private/review-report.json
```

The live adapter only calls allowlisted reads at the fixed hosted MCP endpoint.
It verifies office identity before fixture reads. It checks bounded lists against
the expected real IDs, synthetic markers and record detail. Publications must
have both read states and synthetic full text. Cross-office exclusion only
counts after the foreign identity proves the record exists. The read-only case
checks that every advertised tool is read-only and client creation is absent
from both catalog and permissions; it does not attempt a mutation.

Reports contain fixed case IDs, passed/failed/blocked states, fixed reason codes,
counts, a timestamp and validated correlation UUIDs. They exclude record IDs,
office identities, raw responses, tool inputs and errors. Output is exclusively
created with mode 0600; existing files are never overwritten. Exit 0 means all
case predicates passed, 2 means blocked or failed cases, and 1 means invalid
input or an execution/output failure. Currently a correctly functioning run
still exits 2 because the two host/runtime cases remain blocked.

`liveReviewCasesVerified`, `nativeHostVerified` and `submissionReady` remain
false. A direct MCP report is technical API evidence, not proof that a host
renders the overview accurately, asks for confirmation or refuses to reveal
credentials. Finish those cases in the actual native host with the advertised runtime
retry and read-only recovery contract. Publisher/domain verification and manual portal
submission still require their own durable receipts. Do not publish private
binding files or reviewer credentials alongside the sanitized report.
