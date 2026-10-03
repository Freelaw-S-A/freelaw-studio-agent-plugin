# Freelaw Studio public distribution contract

This tree is the public, client-facing distribution envelope for the hosted
Freelaw Studio MCP. It is authored in the private monorepo and exported through
an allowlisted process; it must never contain private monorepo code, credentials,
customer data, Backstage/admin instructions, local binaries or install hooks.

- Runtime ownership stays in Studio Offices. Every host manifest points to
  `https://app.freelaw.ai/api/agent/mcp`; do not add another MCP runtime here.
- `distribution/release.json` owns released package/readiness facts and
  `distribution/providers.json` owns provider capability/submission facts.
  Website copy and release handoffs derive from these files.
- Installation, authenticated validation, submission, approval and publication
  are separate states. Advance a state only with a durable provider receipt.
- Keep `v0.4.1` and its release URLs immutable. A changed package ships as a new
  version and tag.
- Public checks may verify discovery without a credential. Authenticated catalog
  and reviewer cases require the dedicated synthetic reviewer account and must
  not log tokens, office data, raw responses or tool inputs.

Run `bun test`, `bun run validate` and `bun run build` from this directory. From
the monorepo root, also run the deterministic export check documented in
`docs/plans/mcp-plugin-monorepo-source.md`.
