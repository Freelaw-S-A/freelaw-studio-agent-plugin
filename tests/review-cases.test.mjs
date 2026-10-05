import { describe, expect, test } from 'bun:test';
import { readFileSync, mkdtempSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createReviewSimulation } from '../scripts/review-simulation.mjs';
import { runReviewCases, validateReviewBindings } from '../scripts/run-review-cases.mjs';
import { createReviewMcpTransport } from '../scripts/review-mcp-transport.mjs';

const now = new Date('2026-10-05T00:00:00Z');
const plan = () => JSON.parse(readFileSync(new URL('../docs/review-fixtures.example.json', import.meta.url), 'utf8'));
const setup = () => { const fixturePlan = plan(); return { plan: fixturePlan, ...createReviewSimulation(fixturePlan, { now }), now }; };
const caseFor = (report, id) => report.cases.find((entry) => entry.id === id);

describe('review case evidence', () => {
  test('executes supported predicates and never fabricates write or host proof', async () => {
    const report = await runReviewCases(setup());
    expect(report.passed).toBe(6);
    expect(report.failed).toBe(0);
    expect(report.blocked).toBe(2);
    expect(caseFor(report, 'confirmed_task').reason).toBe('task_idempotency_not_supported');
    expect(caseFor(report, 'credential_refusal').reason).toBe('native_host_required');
    expect(report.evidenceKind).toBe('simulation');
    expect(report.liveReviewCasesVerified).toBe(false);
    expect(report.nativeHostVerified).toBe(false);
    expect(report.submissionReady).toBe(false);
  });
  test('advertised task retry and recovery still require native host proof', async () => {
    const input = setup(), catalog = input.primary.catalog.bind(input.primary);
    input.primary.catalog = async () => [...await catalog(),
      { name: 'office__tasks__create', inputSchema: { properties: { idempotencyKey: { type: 'string', format: 'uuid' } } } },
      { name: 'office__tasks__getByIdempotencyKey', annotations: { readOnlyHint: true }, inputSchema: { properties: { idempotencyKey: { type: 'string', format: 'uuid' } } } },
    ];
    const report = await runReviewCases(input);
    expect(caseFor(report, 'confirmed_task')).toMatchObject({ status: 'blocked', reason: 'native_host_required' });
    expect(report.submissionReady).toBe(false);
    expect(report.nativeHostVerified).toBe(false);
  });
  test('empty fixture lists fail instead of accepting zero results', async () => {
    const input = setup(), call = input.primary.call.bind(input.primary);
    input.primary.call = async (name, args) => name === 'clients.list' ? { clients: [] } : call(name, args);
    expect(caseFor(await runReviewCases(input), 'client_lookup').status).toBe('failed');
  });
  test('foreign or duplicate records in a primary campaign list fail', async () => {
    const input = setup(), call = input.primary.call.bind(input.primary);
    input.primary.call = async (name, args) => {
      const result = await call(name, args);
      if (name === 'clients.list') {
        const foreignId = input.bindings.fixtures[input.plan.fixtures.find((f) => f.office === 'foreign').key];
        result.clients.push({ ...result.clients[0], id: foreignId }); result.count++; result.total++;
      }
      return result;
    };
    expect(caseFor(await runReviewCases(input), 'client_lookup').status).toBe('failed');
  });
  test('overview must contain known attention fixtures in complete canonical sections', async () => {
    for (const fault of ['processing', 'missing_section', 'missing_fixture']) {
      const input = setup(), call = input.primary.call.bind(input.primary);
      input.primary.call = async (name, args) => {
        const result = await call(name, args);
        if (name === 'dailySummary.get') {
          if (fault === 'processing') result.state = 'processing';
          if (fault === 'missing_section') delete result.sections.tasksWithoutDate;
          if (fault === 'missing_fixture') result.sections.tasks = { key: 'tasks', state: 'empty', items: [], count: 0 };
        }
        return result;
      };
      expect(caseFor(await runReviewCases(input), 'overview').status).toBe('failed');
    }
  });
  test('known foreign record must exist before its exclusion proves isolation', async () => {
    const input = setup(), call = input.foreign.call.bind(input.foreign);
    input.foreign.call = async (name, args) => name === 'clients.get' ? { client: null } : call(name, args);
    expect(caseFor(await runReviewCases(input), 'cross_office').status).toBe('failed');
  });
  test('cross-office service failure cannot masquerade as permission denial', async () => {
    const input = setup(), call = input.primary.call.bind(input.primary);
    const foreignId = input.bindings.fixtures[input.plan.fixtures.find((f) => f.office === 'foreign' && f.type === 'client').key];
    input.primary.call = async (name, args) => { if (name === 'clients.get' && args.id === foreignId) throw new Error('private service error'); return call(name, args); };
    expect(caseFor(await runReviewCases(input), 'cross_office').status).toBe('failed');
  });
  test('missing separately scoped identities remain blocked', async () => {
    const input = setup(); delete input.foreign; delete input.readOnly;
    const report = await runReviewCases(input);
    expect(caseFor(report, 'cross_office').reason).toBe('foreign_identity_required');
    expect(caseFor(report, 'read_only_mutation').reason).toBe('read_only_identity_required');
  });
  test('mis-scoped read-only catalog fails without calling any mutation', async () => {
    const input = setup(); input.readOnly = input.primary;
    expect(caseFor(await runReviewCases(input), 'read_only_mutation').status).toBe('failed');
  });
  test('wrong organization fails before fixture reads', async () => {
    const input = setup(); input.primary = input.foreign;
    const report = await runReviewCases(input);
    expect(report.passed).toBe(0); expect(report.failed).toBe(8);
  });
  test('missing primary token produces eight blocked cases', async () => {
    const input = setup(); delete input.primary;
    const report = await runReviewCases(input);
    expect(report.passed).toBe(0); expect(report.blocked).toBe(8);
  });
  test('untrusted details, errors and invalid correlation IDs are not exported', async () => {
    const input = setup(), call = input.primary.call.bind(input.primary);
    input.primary.call = async (name, args) => { if (name === 'dailySummary.get') throw new Error('Bearer secret-token customer@example.invalid'); return call(name, args); };
    input.primary.correlationIds = () => ['secret-token', '10000000-0000-4000-8000-000000000001'];
    const report = await runReviewCases(input), serialized = JSON.stringify(report);
    expect(serialized).not.toContain('secret-token'); expect(serialized).not.toContain('@');
    expect(serialized).not.toContain(input.bindings.offices.primary);
    expect(report.correlationIds).toEqual(['10000000-0000-4000-8000-000000000001']);
  });
  test('bindings reject unknown keys, duplicate IDs and same office', () => {
    const input = setup();
    expect(validateReviewBindings(input.plan, input.bindings)).toBe(true);
    expect(validateReviewBindings(input.plan, { ...input.bindings, token: 'private' })).toBe(false);
    input.bindings.offices.foreign = input.bindings.offices.primary;
    expect(validateReviewBindings(input.plan, input.bindings)).toBe(false);
  });
  test('runs case predicates through the actual HTTP/RPC adapter using simulated server responses', async () => {
    const input = setup();
    const adapt = (simulation) => createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      let result;
      if (request.method === 'initialize') result = { protocolVersion: '2025-06-18', capabilities: { tools: {} } };
      else if (request.method === 'tools/list') result = { tools: await simulation.catalog() };
      else {
        const action = request.params.name.replace('office__', '').replaceAll('__', '.');
        const data = await simulation.call(action, request.params.arguments);
        result = { resultType: 'complete', content: [{ type: 'text', text: JSON.stringify(data) }] };
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { resultType: 'complete', ...result, _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'freelaw-office-actions', version: '1.0.0' } } } }));
    } });
    input.primary = adapt(input.primary); input.foreign = adapt(input.foreign); input.readOnly = adapt(input.readOnly);
    const report = await runReviewCases(input);
    expect(report.passed).toBe(6); expect(report.failed).toBe(0); expect(report.blocked).toBe(2);
    expect(report.liveReviewCasesVerified).toBe(false);
  });
});

describe('bounded hosted read-only transport', () => {
  const response = (id, result) => new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { resultType: 'complete', ...result, _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'freelaw-office-actions', version: '1.0.0' } } } }), { headers: { 'Content-Type': 'application/json' } });
  test('never transmits a live write, even when invoked directly', async () => {
    let calls = 0;
    const transport = createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async () => { calls++; return response(1, {}); } });
    await expect(transport.call('tasks.create', { title: 'synthetic' })).rejects.toThrow('live_write_forbidden');
    expect(calls).toBe(0);
  });
  test('uses fixed origin, strict RPC identity and redirect protection', async () => {
    const transport = createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async (url, options) => {
      expect(url).toBe('https://app.freelaw.ai/api/agent/mcp'); expect(options.redirect).toBe('error');
      return response(99, { structuredContent: { client: null } });
    } });
    await expect(transport.call('clients.get', {})).rejects.toThrow('transport_failed');
  });
  test('rejects tool errors even when output looks successful', async () => {
    const transport = createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async () => response(1, { isError: true, structuredContent: { client: null } }) });
    await expect(transport.call('clients.get', {})).rejects.toThrow('tool_failed');
  });
  test('supports legacy text JSON without parsing arbitrary prose', async () => {
    const transport = createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async () => response(1, { content: [{ type: 'text', text: '{"client":null}' }] }) });
    expect(await transport.call('clients.get', {})).toEqual({ client: null });
  });
  test('rejects contradictory structured output and incomplete envelopes', async () => {
    const transport = createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async () => response(1, { structuredContent: { client: null }, content: [{ type: 'text', text: '{"client":{"id":"unexpected"}}' }] }) });
    await expect(transport.call('clients.get', {})).rejects.toThrow('tool_failed');
    const incomplete = createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: '{"client":null}' }] } })) });
    await expect(incomplete.call('clients.get', {})).rejects.toThrow('transport_failed');
  });
  test('rejects excessive body size', async () => {
    const transport = createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async () => new Response('x'.repeat(1_048_577)) });
    await expect(transport.call('clients.get', {})).rejects.toThrow('transport_failed');
  });
  test('rejects incomplete or duplicate catalogs', async () => {
    const tool = { name: 'office__clients__get', annotations: { readOnlyHint: true } };
    const transport = createReviewMcpTransport({ token: 'synthetic-test-only', fetchImpl: async () => response(1, { tools: [tool, tool] }) });
    await expect(transport.catalog()).rejects.toThrow('transport_failed');
  });
});

test('CLI creates a private sanitized simulation report and refuses to overwrite it', () => {
  const temp = mkdtempSync(join(tmpdir(), 'freelaw-review-kit-test-'));
  try {
    const fixturePlan = plan(), clock = Date.now();
    fixturePlan.createdAt = new Date(clock - 60_000).toISOString();
    fixturePlan.expiresAt = new Date(clock + 86_400_000).toISOString();
    const input = join(temp, 'plan.json'), output = join(temp, 'report.json');
    writeFileSync(input, JSON.stringify(fixturePlan));
    const script = new URL('../scripts/run-review-cases.mjs', import.meta.url).pathname;
    const args = [script, '--simulate', '--plan', input, '--output', output];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(result.status).toBe(2);
    const initial = readFileSync(output, 'utf8');
    expect(JSON.parse(initial).passed).toBe(6);
    expect(statSync(output).mode & 0o777).toBe(0o600);
    const retry = spawnSync(process.execPath, args, { encoding: 'utf8' });
    expect(retry.status).toBe(1);
    expect(readFileSync(output, 'utf8')).toBe(initial);
    expect(retry.stderr).not.toContain(temp);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
