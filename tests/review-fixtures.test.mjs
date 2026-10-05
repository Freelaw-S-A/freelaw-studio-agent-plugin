import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReviewFixtures } from '../scripts/review-fixtures.mjs';

const NOW = new Date('2026-10-05T00:00:00.000Z');
const examplePath = fileURLToPath(new URL('../docs/review-fixtures.example.json', import.meta.url));
const scriptPath = fileURLToPath(new URL('../scripts/review-fixtures.mjs', import.meta.url));
const example = JSON.parse(readFileSync(examplePath, 'utf8'));
const clone = () => structuredClone(example);

describe('offline external-review fixture plan', () => {
  test('accepts the checked-in synthetic two-office plan', () => {
    expect(validateReviewFixtures(example, { now: NOW })).toEqual({ valid: true, issues: [] });
  });

  test('rejects top-level, nested, fixture, reference and cleanup extra fields', () => {
    const plan = clone();
    plan.email = 'reviewer@example.test';
    plan.offices[0].id = 'actual-office-id';
    plan.fixtures[0].content = 'private content';
    plan.fixtures[2].refs.secret = 'raw-secret';
    plan.cleanup.token = 'raw-token';
    expect(validateReviewFixtures(plan, { now: NOW }).issues).toEqual(expect.arrayContaining([
      'cleanup_fields_invalid', 'fixture_fields_invalid', 'fixture_refs_invalid',
      'office_fields_invalid', 'plan_fields_invalid',
    ]));
  });

  test('requires fixed purpose, synthetic flags, dedicated offices and marker', () => {
    const plan = clone();
    plan.campaign = '550e8400-e29b-41d4-a716-446655440000';
    plan.purpose = 'live-evidence';
    plan.synthetic = false;
    plan.offices[0].dedicated = false;
    plan.offices[1].synthetic = false;
    plan.fixtures[0].synthetic = false;
    plan.fixtures[1].marker = 'customer-data';
    expect(validateReviewFixtures(plan, { now: NOW }).issues).toEqual(expect.arrayContaining([
      'campaign_invalid', 'fixture_marker_invalid', 'fixture_synthetic_required', 'office_dedicated_required',
      'office_synthetic_required', 'purpose_invalid', 'synthetic_required',
    ]));
  });

  test('enforces UTC timestamps, active validation time and thirty-day retention', () => {
    const malformed = clone();
    malformed.createdAt = '2026-10-04T00:00:00-03:00';
    malformed.expiresAt = '2026-02-30T00:00:00.000Z';
    expect(validateReviewFixtures(malformed, { now: NOW }).issues).toEqual(expect.arrayContaining([
      'created_at_invalid', 'expires_at_invalid',
    ]));

    const long = clone();
    long.expiresAt = '2026-11-04T00:00:00.001Z';
    expect(validateReviewFixtures(long, { now: NOW }).issues).toContain('retention_invalid');
    expect(validateReviewFixtures(example, { now: '2026-10-18T00:00:00.000Z' }).issues).toContain('plan_expired');
    expect(validateReviewFixtures(example, { now: 'invalid' }).issues).toContain('validation_time_invalid');
  });

  test('requires symbolic unique fixture keys and referential integrity', () => {
    const plan = clone();
    plan.fixtures[0].key = '550e8400-e29b-41d4-a716-446655440000';
    plan.fixtures.at(-1).key = plan.fixtures[1].key;
    plan.fixtures[2].refs.client = 'missing-client';
    plan.fixtures[4].office = 'foreign';
    plan.fixtures[5].refs.client = 'primary-client-two';
    expect(validateReviewFixtures(plan, { now: NOW }).issues).toEqual(expect.arrayContaining([
      'fixture_key_duplicate', 'fixture_key_invalid', 'fixture_ref_missing',
      'fixture_ref_office_mismatch', 'task_process_client_mismatch',
    ]));
  });

  test('requires typed links and the minimum fixture inventory', () => {
    const plan = clone();
    plan.fixtures[2].refs.client = 'primary-process';
    plan.fixtures = plan.fixtures.filter((fixture) => ![
      'primary-client-two', 'primary-publication-two', 'primary-task', 'foreign-client',
    ].includes(fixture.key));
    expect(validateReviewFixtures(plan, { now: NOW }).issues).toEqual(expect.arrayContaining([
      'fixture_ref_type_invalid', 'foreign_client_missing', 'primary_client_count_invalid',
      'primary_publication_count_invalid', 'primary_task_count_invalid',
    ]));
  });

  test('requires exact primary inventory while allowing additional foreign clients', () => {
    const surplusPrimary = clone();
    surplusPrimary.fixtures.push({
      ...structuredClone(surplusPrimary.fixtures[0]),
      key: 'primary-client-three',
    });
    expect(validateReviewFixtures(surplusPrimary, { now: NOW }).issues).toContain(
      'primary_client_count_invalid',
    );

    const extraForeign = clone();
    extraForeign.fixtures.push({
      ...structuredClone(extraForeign.fixtures.at(-1)),
      key: 'foreign-client-two',
    });
    expect(validateReviewFixtures(extraForeign, { now: NOW })).toEqual({ valid: true, issues: [] });
  });

  test('bounds campaign, symbolic keys and total fixtures', () => {
    const plan = clone();
    plan.campaign = 'a'.repeat(65);
    plan.fixtures[0].key = 'b'.repeat(65);
    plan.fixtures = Array.from({ length: 101 }, (_, index) => ({
      ...structuredClone(plan.fixtures.at(-1)),
      key: `foreign-client-${index}`,
      marker: `SYNTHETIC:${plan.campaign}`,
    }));
    plan.fixtures[0].key = 'b'.repeat(65);
    const result = validateReviewFixtures(plan, { now: NOW });
    expect(result.issues).toEqual(expect.arrayContaining([
      'campaign_invalid', 'fixture_key_invalid', 'fixtures_too_many',
    ]));
  });

  test('CLI reports unreadable input generically without echoing its path', () => {
    const privatePath = fileURLToPath(new URL('missing-private-review-token.json', import.meta.url));
    const result = spawnSync(process.execPath, [
      scriptPath, '--plan', privatePath,
    ]);
    expect(result.status).toBe(1);
    expect(result.stdout.toString()).toBe('{"valid":false,"issues":["plan_unreadable"]}\n');
    expect(result.stderr.toString()).toBe('Review fixture plan validation failed.\n');
    expect(`${result.stdout}${result.stderr}`).not.toContain(privatePath);
  });

  test('CLI rejects non-regular and oversized plans with the same generic result', () => {
    const directoryResult = spawnSync(process.execPath, [scriptPath, '--plan', tmpdir()]);
    expect(directoryResult.status).toBe(1);
    expect(directoryResult.stdout.toString()).toBe('{"valid":false,"issues":["plan_unreadable"]}\n');

    const root = mkdtempSync(join(tmpdir(), 'review-fixtures-test-'));
    try {
      const oversized = join(root, 'oversized.json');
      writeFileSync(oversized, ' '.repeat((64 * 1024) + 1));
      const oversizedResult = spawnSync(process.execPath, [scriptPath, '--plan', oversized]);
      expect(oversizedResult.status).toBe(1);
      expect(oversizedResult.stdout.toString()).toBe(
        '{"valid":false,"issues":["plan_unreadable"]}\n',
      );
      expect(`${oversizedResult.stdout}${oversizedResult.stderr}`).not.toContain(oversized);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('returns only fixed issue codes and never raw rejected values', () => {
    const secret = 'Authorization-Bearer-private-value';
    const result = validateReviewFixtures({ secret }, { now: NOW });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([...result.issues].sort());
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(Object.keys(result)).toEqual(['valid', 'issues']);
  });
});
