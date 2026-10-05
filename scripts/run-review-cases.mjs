import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReviewFixtures } from './review-fixtures.mjs';
import { createReviewMcpTransport, record, uuid } from './review-mcp-transport.mjs';

const CASES = ['overview', 'client_lookup', 'pending_tasks', 'publications', 'confirmed_task', 'cross_office', 'read_only_mutation', 'credential_refusal'];
const assert = (condition) => { if (!condition) throw new Error('case_failed'); };
const exactKeys = (object, keys) => record(object) && Object.keys(object).length === keys.length && keys.every((key) => Object.hasOwn(object, key));
export function validateReviewBindings(plan, bindings) {
  return exactKeys(bindings, ['schemaVersion', 'offices', 'fixtures']) && bindings.schemaVersion === 1
    && exactKeys(bindings.offices, ['primary', 'foreign']) && Object.values(bindings.offices).every(uuid)
    && bindings.offices.primary !== bindings.offices.foreign
    && exactKeys(bindings.fixtures, plan.fixtures.map((fixture) => fixture.key))
    && Object.values(bindings.fixtures).every(uuid)
    && new Set(Object.values(bindings.fixtures)).size === plan.fixtures.length;
}

export async function runReviewCases({ plan, bindings, primary, foreign, readOnly, now = new Date() }) {
  const validation = validateReviewFixtures(plan, { now });
  if (!validation.valid) throw new Error('invalid_fixture_plan');
  if (!validateReviewBindings(plan, bindings)) throw new Error('invalid_bindings');
  const simulation = primary?.kind === 'simulation';
  const cases = CASES.map((id) => ({ id, status: 'blocked', reason: 'credential_required' }));
  const apply = async (id, run) => {
    const entry = cases.find((value) => value.id === id);
    try { const reason = await run(); Object.assign(entry, reason ? { status: 'blocked', reason } : { status: 'passed', reason: 'verified' }); }
    catch { Object.assign(entry, { status: 'failed', reason: 'case_failed' }); }
  };
  const fixtures = (type, office = 'primary') => plan.fixtures.filter((f) => f.type === type && f.office === office);
  const id = (fixture) => bindings.fixtures[fixture.key];
  const marker = `SYNTHETIC:${plan.campaign}`;
  const primaryIds = new Set(plan.fixtures.filter((fixture) => fixture.office === 'primary').map(id));
  const page = (result, field, type) => {
    const expected = fixtures(type).map(id), rows = result[field];
    assert(Array.isArray(rows) && rows.length === expected.length && result.count === expected.length && result.total === expected.length && result.limit === 100 && result.offset === 0);
    assert(new Set(rows.map((row) => row.id)).size === expected.length && rows.every((row) => expected.includes(row.id)));
    return rows;
  };
  const identity = async (transport, office) => {
    assert(transport.kind === (simulation ? 'simulation' : 'direct-mcp'));
    await transport.initialize();
    const actor = await transport.call('permissions.describe');
    assert(actor.organizationId === bindings.offices[office] && Array.isArray(actor.allowedActions));
    const catalog = await transport.catalog();
    return { actor, catalog };
  };
  let connected = false;
  let primaryCatalog = [];
  if (primary) {
    try { ({ catalog: primaryCatalog } = await identity(primary, 'primary')); connected = true; }
    catch { for (const entry of cases) Object.assign(entry, { status: 'failed', reason: 'identity_verification_failed' }); }
  }
  if (connected) {
    await apply('overview', async () => {
      const result = await primary.call('dailySummary.get', {});
      assert(result.available === true && result.state === 'ready' && result.hasMore === false);
      assert(result.scope === 'mine' && Array.isArray(result.items) && record(result.counts) && typeof result.generatedAt === 'string' && Number.isFinite(Date.parse(result.generatedAt)));
      for (const key of ['tasks', 'tasksWithoutDate', 'publications', 'deadlines', 'processes']) {
        const section = result.sections?.[key];
        assert(record(section) && section.key === key && Array.isArray(section.items) && section.count === section.items.length && section.state === (section.count ? 'ready' : 'empty'));
        assert(section.items.every((item) => primaryIds.has(item.sourceId)));
      }
      assert(result.items.every((item) => primaryIds.has(item.sourceId)));
      assert([...result.sections.tasks.items, ...result.sections.tasksWithoutDate.items].some((item) => item.sourceId === id(fixtures('task')[0])));
      assert(result.sections.publications.items.some((item) => fixtures('publication').some((fixture) => item.sourceId === id(fixture))));
    });
    await apply('client_lookup', async () => {
      const result = await primary.call('clients.list', { query: marker, limit: 100 });
      page(result, 'clients', 'client');
      for (const fixture of fixtures('client')) {
        assert(result.clients.some((row) => row.id === id(fixture) && row.full_name?.includes(marker)));
        const detail = await primary.call('clients.get', { id: id(fixture) });
        assert(detail.client?.id === id(fixture) && detail.client.full_name?.includes(marker));
      }
    });
    await apply('pending_tasks', async () => {
      const result = await primary.call('tasks.list', { query: marker, status: ['pending'], scope: 'mine', limit: 100 });
      assert(result.scopeDenied !== true && result.scope === 'mine');
      page(result, 'tasks', 'task');
      for (const fixture of fixtures('task')) assert(result.tasks.some((row) => row.id === id(fixture) && row.title?.includes(marker) && row.status === 'pending' && row.client_id === bindings.fixtures[fixture.refs.client] && row.process_id === bindings.fixtures[fixture.refs.process]));
    });
    await apply('publications', async () => {
      const process = fixtures('process')[0];
      const result = await primary.call('publications.list', { processId: id(process), limit: 100 });
      assert(result.resultState === 'encontrado' && result.hasMore === false);
      page(result, 'publications', 'publication');
      const states = new Set();
      for (const fixture of fixtures('publication')) {
        const row = result.publications.find((value) => value.id === id(fixture));
        assert(row && row.processId === id(process) && typeof row.isRead === 'boolean');
        states.add(row.isRead);
        const detail = await primary.call('publications.get', { id: id(fixture) });
        assert(detail.publication?.id === id(fixture) && detail.publication.processId === id(process) && detail.publication.content?.includes(marker));
      }
      assert(states.size === 2);
    });
    await apply('confirmed_task', async () => {
      const create = primaryCatalog.find((tool) => tool.name === 'office__tasks__create');
      const recovery = primaryCatalog.find((tool) => tool.name === 'office__tasks__getByIdempotencyKey');
      const key = create?.inputSchema?.properties?.idempotencyKey;
      const supported = key?.type === 'string' && key.format === 'uuid'
        && recovery?.annotations?.readOnlyHint === true
        && recovery.inputSchema?.properties?.idempotencyKey?.format === 'uuid';
      return supported ? 'native_host_required' : 'task_idempotency_not_supported';
    });
    await apply('cross_office', async () => {
      if (!foreign) return 'foreign_identity_required';
      await identity(foreign, 'foreign');
      const fixture = fixtures('client', 'foreign')[0];
      const source = await foreign.call('clients.get', { id: id(fixture) });
      assert(source.client?.id === id(fixture) && source.client.full_name?.includes(marker));
      const denied = await primary.call('clients.get', { id: id(fixture) });
      assert(denied.client === null);
    });
    await apply('read_only_mutation', async () => {
      if (!readOnly) return 'read_only_identity_required';
      const { actor, catalog } = await identity(readOnly, 'primary');
      assert(actor.allowedActions.length > 0 && catalog.length > 0);
      assert(!actor.allowedActions.includes('office.clients.create') && !catalog.some((tool) => tool.name === 'office__clients__create'));
      assert(catalog.every((tool) => tool.annotations?.readOnlyHint === true));
    });
    await apply('credential_refusal', async () => {
      return 'native_host_required';
    });
  }
  const correlationIds = [...new Set([primary, foreign, readOnly].flatMap((t) => t?.correlationIds?.() ?? []).filter(uuid))].slice(0, 32);
  return {
    schemaVersion: 1, checkedAt: now.toISOString(), evidenceKind: simulation ? 'simulation' : 'direct-mcp',
    cases, correlationIds, passed: cases.filter((c) => c.status === 'passed').length,
    failed: cases.filter((c) => c.status === 'failed').length, blocked: cases.filter((c) => c.status === 'blocked').length,
    liveReviewCasesVerified: false, nativeHostVerified: false, submissionReady: false,
  };
}

export function readReviewInput(path, { privateFile = false } = {}) {
  if (!path) throw new Error('invalid_input_file');
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > 65_536 || (privateFile && (stat.mode & 0o077) !== 0)) throw new Error('invalid_input_file');
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const option = (name) => args[args.indexOf(name) + 1];
    const allowed = new Set(['--plan', '--bindings', '--output', '--simulate']);
    const seen = new Set();
    for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i]) || seen.has(args[i])) throw new Error('invalid_cli'); seen.add(args[i]); if (args[i] !== '--simulate') { if (!args[++i] || args[i].startsWith('--')) throw new Error('invalid_cli'); } }
    if (!args.includes('--plan') || !args.includes('--output')) throw new Error('invalid_cli');
    const plan = readReviewInput(option('--plan'));
    let runtime;
    if (args.includes('--simulate')) {
      if (args.includes('--bindings')) throw new Error('invalid_cli');
      const { createReviewSimulation } = await import('./review-simulation.mjs');
      runtime = createReviewSimulation(plan);
    } else {
      if (!args.includes('--bindings')) throw new Error('invalid_cli');
      const transport = (name) => process.env[name] ? createReviewMcpTransport({ token: process.env[name] }) : undefined;
      runtime = { bindings: readReviewInput(option('--bindings'), { privateFile: true }), primary: transport('FREELAW_REVIEW_MCP_TOKEN'), foreign: transport('FREELAW_REVIEW_FOREIGN_MCP_TOKEN'), readOnly: transport('FREELAW_REVIEW_READ_ONLY_MCP_TOKEN') };
    }
    const report = await runReviewCases({ plan, ...runtime });
    writeFileSync(option('--output'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify(report));
    if (report.failed || report.blocked) process.exitCode = 2;
  } catch { console.error('Review kit failed. Validate the plan, private bindings and output path; no raw responses were logged.'); process.exitCode = 1; }
}
