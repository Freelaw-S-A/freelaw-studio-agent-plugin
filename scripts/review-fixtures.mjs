import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RETENTION_MS = 30 * DAY_MS;
const MAX_FIXTURES = 100;
const MAX_PLAN_BYTES = 64 * 1024;
const MAX_SYMBOLIC_KEY_LENGTH = 64;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const TYPES = new Set(['client', 'process', 'publication', 'task']);
const OFFICE_KEYS = new Set(['primary', 'foreign']);

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!record(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function symbolicKey(value) {
  return typeof value === 'string'
    && value.length <= MAX_SYMBOLIC_KEY_LENGTH
    && SLUG.test(value)
    && !UUID.test(value)
    && !/^\d+$/.test(value);
}

function utcMillis(value) {
  if (typeof value !== 'string' || !UTC_TIMESTAMP.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const canonical = new Date(milliseconds).toISOString();
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  return canonical === normalized ? milliseconds : null;
}

function expectedRefs(type) {
  if (type === 'client') return [];
  if (type === 'process') return ['client'];
  if (type === 'publication') return ['process'];
  if (type === 'task') return ['client', 'process'];
  return null;
}

/**
 * Validate a synthetic external-review fixture plan without reading credentials,
 * connecting to a service, or mutating data. Issues are fixed codes and never
 * contain input values.
 */
export function validateReviewFixtures(plan, { now = new Date() } = {}) {
  const issues = new Set();
  const add = (code) => issues.add(code);

  if (!record(plan)) {
    return { valid: false, issues: ['plan_not_object'] };
  }

  if (!hasExactKeys(plan, [
    'campaign', 'cleanup', 'createdAt', 'expiresAt', 'fixtures', 'offices',
    'purpose', 'schemaVersion', 'synthetic',
  ])) add('plan_fields_invalid');
  if (plan.schemaVersion !== 1) add('schema_version_invalid');
  if (!symbolicKey(plan.campaign)) add('campaign_invalid');
  if (plan.purpose !== 'external-directory-review') add('purpose_invalid');
  if (plan.synthetic !== true) add('synthetic_required');

  const createdAt = utcMillis(plan.createdAt);
  const expiresAt = utcMillis(plan.expiresAt);
  if (createdAt === null) add('created_at_invalid');
  if (expiresAt === null) add('expires_at_invalid');
  if (createdAt !== null && expiresAt !== null) {
    if (expiresAt <= createdAt || expiresAt - createdAt > MAX_RETENTION_MS) {
      add('retention_invalid');
    }
  }
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) {
    add('validation_time_invalid');
  } else {
    if (createdAt !== null && createdAt > nowMs) add('created_at_in_future');
    if (expiresAt !== null && expiresAt <= nowMs) add('plan_expired');
  }

  const officeKeys = new Set();
  if (!Array.isArray(plan.offices)) {
    add('offices_invalid');
  } else {
    for (const office of plan.offices) {
      if (!hasExactKeys(office, ['dedicated', 'key', 'synthetic'])) {
        add('office_fields_invalid');
        continue;
      }
      if (!OFFICE_KEYS.has(office.key)) add('office_key_invalid');
      if (office.dedicated !== true) add('office_dedicated_required');
      if (office.synthetic !== true) add('office_synthetic_required');
      if (officeKeys.has(office.key)) add('office_key_duplicate');
      else officeKeys.add(office.key);
    }
    if (plan.offices.length !== 2 || !officeKeys.has('primary') || !officeKeys.has('foreign')) {
      add('required_offices_missing');
    }
  }

  const fixtureByKey = new Map();
  const seenFixtureKeys = new Set();
  const fixtures = Array.isArray(plan.fixtures) ? plan.fixtures.slice(0, MAX_FIXTURES) : [];
  const expectedMarker = typeof plan.campaign === 'string' ? `SYNTHETIC:${plan.campaign}` : null;
  if (!Array.isArray(plan.fixtures)) add('fixtures_invalid');
  else if (plan.fixtures.length > MAX_FIXTURES) add('fixtures_too_many');
  for (const fixture of fixtures) {
    if (!hasExactKeys(fixture, ['key', 'marker', 'office', 'refs', 'synthetic', 'type'])) {
      add('fixture_fields_invalid');
      continue;
    }
    if (!symbolicKey(fixture.key)) add('fixture_key_invalid');
    if (!TYPES.has(fixture.type)) add('fixture_type_invalid');
    if (!OFFICE_KEYS.has(fixture.office)) add('fixture_office_invalid');
    if (fixture.synthetic !== true) add('fixture_synthetic_required');
    if (fixture.marker !== expectedMarker) add('fixture_marker_invalid');
    const refs = expectedRefs(fixture.type);
    if (refs === null || !hasExactKeys(fixture.refs, refs)) {
      add('fixture_refs_invalid');
    } else if (refs.some((ref) => !symbolicKey(fixture.refs[ref]))) {
      add('fixture_ref_key_invalid');
    }
    if (seenFixtureKeys.has(fixture.key)) add('fixture_key_duplicate');
    else seenFixtureKeys.add(fixture.key);
    if (symbolicKey(fixture.key) && !fixtureByKey.has(fixture.key)) {
      fixtureByKey.set(fixture.key, fixture);
    }
  }

  for (const fixture of fixtures) {
    if (!record(fixture) || !record(fixture.refs) || !TYPES.has(fixture.type)) continue;
    const links = expectedRefs(fixture.type) ?? [];
    for (const link of links) {
      const target = fixtureByKey.get(fixture.refs[link]);
      if (!target) {
        add('fixture_ref_missing');
        continue;
      }
      if (target.type !== link) add('fixture_ref_type_invalid');
      if (target.office !== fixture.office) add('fixture_ref_office_mismatch');
    }
    if (fixture.type === 'task') {
      const process = fixtureByKey.get(fixture.refs.process);
      if (process?.type === 'process' && process.refs?.client !== fixture.refs.client) {
        add('task_process_client_mismatch');
      }
    }
  }

  const primaryCounts = Object.fromEntries([...TYPES].map((type) => [type, 0]));
  let foreignClients = 0;
  for (const fixture of fixtures) {
    if (!record(fixture) || !TYPES.has(fixture.type)) continue;
    if (fixture.office === 'primary') primaryCounts[fixture.type] += 1;
    if (fixture.office === 'foreign' && fixture.type === 'client') foreignClients += 1;
  }
  if (primaryCounts.client !== 2) add('primary_client_count_invalid');
  if (primaryCounts.process !== 1) add('primary_process_count_invalid');
  if (primaryCounts.publication !== 2) add('primary_publication_count_invalid');
  if (primaryCounts.task !== 1) add('primary_task_count_invalid');
  if (foreignClients < 1) add('foreign_client_missing');

  if (!hasExactKeys(plan.cleanup, [
    'afterExpires', 'dryRunRequired', 'owner', 'preserveAudit',
  ])) {
    add('cleanup_fields_invalid');
  } else {
    if (plan.cleanup.owner !== 'review-operator') add('cleanup_owner_invalid');
    if (plan.cleanup.dryRunRequired !== true) add('cleanup_dry_run_required');
    if (plan.cleanup.afterExpires !== true) add('cleanup_after_expiry_required');
    if (plan.cleanup.preserveAudit !== true) add('cleanup_preserve_audit_required');
  }

  const sorted = [...issues].sort();
  return { valid: sorted.length === 0, issues: sorted };
}

function argument(name) {
  const matches = process.argv.slice(2).filter((value) => value === name).length;
  if (matches !== 1) return undefined;
  const index = process.argv.indexOf(name);
  return process.argv[index + 1];
}

function runCli() {
  let result;
  try {
    const path = argument('--plan');
    if (!path || process.argv.length !== 4) throw new Error('invalid arguments');
    const resolved = resolve(path);
    const stat = lstatSync(resolved);
    if (!stat.isFile() || stat.size > MAX_PLAN_BYTES) throw new Error('invalid plan file');
    const plan = JSON.parse(readFileSync(resolved, 'utf8'));
    result = validateReviewFixtures(plan);
  } catch {
    result = { valid: false, issues: ['plan_unreadable'] };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.valid) {
    process.stderr.write('Review fixture plan validation failed.\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
