import { afterEach, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runLiveReadiness } from '../scripts/run-live-readiness.mjs';
import { validateCicd } from '../scripts/validate-cicd.mjs';

const temporary = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function checked(overrides = {}) {
  return {
    packageVersion: '0.4.2',
    serverUrl: 'https://app.freelaw.ai/api/agent/mcp',
    publicTransportVerified: true,
    authenticatedToolScanVerified: false,
    toolCount: null,
    submissionReady: true,
    oauthConsentFlowVerified: true,
    reviewCasesExecuted: true,
    privateOfficeId: 'must-not-project',
    ...overrides,
  };
}

function cicdFixture() {
  const root = mkdtempSync(join(tmpdir(), 'freelaw-live-readiness-test-'));
  temporary.push(root);
  for (const path of ['.github', 'distribution']) {
    cpSync(resolve(path), join(root, path), { recursive: true });
  }
  return root;
}

describe('live MCP readiness receipt', () => {
  test('public mode does not observe credentials and forces review claims false', async () => {
    let options;
    const result = await runLiveReadiness({
      mode: 'public',
      token: 'must-not-be-observed',
      check: async (value) => {
        options = value;
        return checked({ authenticatedToolScanVerified: true, toolCount: 99 });
      },
      now: () => new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(options).toEqual({});
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        credentialConfigured: null,
        publicTransportVerified: true,
        authenticatedToolScanVerified: false,
        toolCount: null,
        submissionReady: false,
        oauthConsentFlowVerified: false,
        reviewCasesExecuted: false,
      },
    });
    expect(JSON.stringify(result.receipt)).not.toContain('must-not');
  });

  test('catalog mode fails safely without a configured credential', async () => {
    let called = false;
    const result = await runLiveReadiness({
      mode: 'catalog',
      token: '',
      check: async () => { called = true; return checked(); },
    });
    expect(called).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      receipt: {
        credentialConfigured: false,
        authenticatedToolScanVerified: false,
        failureCode: 'readiness_check_failed',
      },
    });
  });

  test('catalog mode treats a whitespace-only credential as absent without calling transport', async () => {
    let called = false;
    const result = await runLiveReadiness({
      mode: 'catalog',
      token: ' \n\t ',
      check: async () => { called = true; return checked(); },
    });
    expect(called).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      receipt: { credentialConfigured: false, failureCode: 'readiness_check_failed' },
    });
  });

  test('catalog CLI writes its sanitized receipt before failing for a missing credential', () => {
    const root = mkdtempSync(join(tmpdir(), 'freelaw-live-readiness-cli-test-'));
    temporary.push(root);
    const output = join(root, 'receipt.json');
    const result = Bun.spawnSync([
      'bun',
      'scripts/run-live-readiness.mjs',
      '--mode',
      'catalog',
      '--output',
      output,
    ], {
      cwd: resolve('.'),
      env: { ...process.env, FREELAW_REVIEW_MCP_TOKEN: '' },
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({
      status: 'failed',
      credentialConfigured: false,
      failureCode: 'readiness_check_failed',
      submissionReady: false,
      oauthConsentFlowVerified: false,
      reviewCasesExecuted: false,
    });
    expect(result.stderr.toString()).not.toContain('FREELAW_REVIEW_MCP_TOKEN');
  });

  test('catalog mode records only sanitized scalar evidence', async () => {
    const token = 'fixture-review-token';
    const result = await runLiveReadiness({
      mode: 'catalog',
      token,
      check: async ({ token: received }) => {
        expect(received).toBe(token);
        return checked({ authenticatedToolScanVerified: true, toolCount: 17 });
      },
    });
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        credentialConfigured: true,
        authenticatedToolScanVerified: true,
        toolCount: 17,
        submissionReady: false,
        oauthConsentFlowVerified: false,
        reviewCasesExecuted: false,
      },
    });
    const serialized = JSON.stringify(result.receipt);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain('privateOfficeId');
    expect(serialized).not.toContain('Authorization');
  });

  test('fault injection returns one generic failure without raw error data', async () => {
    const secretError = 'office-123 Authorization: Bearer leaked-token';
    const result = await runLiveReadiness({
      mode: 'catalog',
      token: 'leaked-token',
      check: async () => { throw new Error(secretError); },
    });
    expect(result).toMatchObject({
      ok: false,
      receipt: {
        credentialConfigured: true,
        failureCode: 'readiness_check_failed',
        submissionReady: false,
      },
    });
    expect(JSON.stringify(result.receipt)).not.toContain(secretError);
    expect(JSON.stringify(result.receipt)).not.toContain('leaked-token');
  });

  test('does not mark an incomplete checker result as passed', async () => {
    const result = await runLiveReadiness({
      mode: 'catalog',
      token: 'fixture-review-token',
      check: async () => checked({ authenticatedToolScanVerified: false, toolCount: null }),
    });
    expect(result).toMatchObject({
      ok: false,
      receipt: {
        status: 'failed',
        credentialConfigured: true,
        failureCode: 'readiness_check_failed',
      },
    });
  });

  test('rejects unexpected checker identity strings without projecting their contents', async () => {
    const sensitive = 'office-123 fixture-review-token';
    const result = await runLiveReadiness({
      mode: 'catalog',
      token: 'fixture-review-token',
      check: async () => checked({
        packageVersion: sensitive,
        serverUrl: `https://example.test/${sensitive}`,
        authenticatedToolScanVerified: true,
        toolCount: 1,
      }),
    });
    expect(result).toMatchObject({
      ok: false,
      receipt: {
        packageVersion: null,
        serverUrl: null,
        failureCode: 'readiness_check_failed',
      },
    });
    expect(JSON.stringify(result.receipt)).not.toContain(sensitive);
    expect(JSON.stringify(result.receipt)).not.toContain('fixture-review-token');
  });
});

describe('live readiness workflow policy', () => {
  test('is manual, main-only, read-only, pinned and absent from PR credentials', () => {
    expect(validateCicd()).toEqual({ workflows: 3, providers: 5, actionsPinned: true });
    const workflow = readFileSync('.github/workflows/live-readiness.yml', 'utf8');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('credentialConfigured');
    expect(readFileSync('.github/workflows/validate.yml', 'utf8')).not.toContain('secrets.');
  });

  test('rejects an unpinned action', () => {
    const root = cicdFixture();
    const path = join(root, '.github/workflows/live-readiness.yml');
    writeFileSync(path, readFileSync(path, 'utf8').replace(/actions\/upload-artifact@[a-f0-9]{40}/, 'actions/upload-artifact@v4'));
    expect(() => validateCicd(root)).toThrow('pinned to a full commit SHA');
  });

  test('rejects write permission', () => {
    const root = cicdFixture();
    const path = join(root, '.github/workflows/live-readiness.yml');
    writeFileSync(path, readFileSync(path, 'utf8').replace('contents: read', 'contents: write'));
    expect(() => validateCicd(root)).toThrow('read-only');
  });

  test('rejects a job-level actions write permission', () => {
    const root = cicdFixture();
    const path = join(root, '.github/workflows/live-readiness.yml');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        '  readiness:\n',
        '  readiness:\n    permissions:\n      actions: write\n',
      ),
    );
    expect(() => validateCicd(root)).toThrow('cannot grant write permissions');
  });

  test('rejects write-all permission', () => {
    const root = cicdFixture();
    const path = join(root, '.github/workflows/live-readiness.yml');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('permissions:\n  contents: read', 'permissions: write-all'),
    );
    expect(() => validateCicd(root)).toThrow('read-only');
  });
});
