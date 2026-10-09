import { afterEach, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateRelease, packagePath } from '../scripts/validate-release.mjs';
import { checkMcpReadiness } from '../scripts/check-mcp-readiness.mjs';
import { validateCicd } from '../scripts/validate-cicd.mjs';
import { verifyReleaseContext } from '../scripts/verify-release-context.mjs';
import { buildSubmissionHandoff, handoffMarkdown } from '../scripts/build-submission-handoff.mjs';
import { reconcileReleaseAssets } from '../scripts/reconcile-release-assets.mjs';
import { detectReleaseState } from '../scripts/detect-release-state.mjs';

const temporary = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'freelaw-plugin-test-'));
  temporary.push(root);
  for (const path of ['package.json', 'gemini-extension.json', '.claude-plugin', 'distribution', 'plugins']) cpSync(resolve(path), join(root, path), { recursive: true });
  return root;
}
function alter(root, file, update) {
  const path = join(root, file);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  update(json);
  writeFileSync(path, JSON.stringify(json));
}

describe('portable plugin release', () => {
  test('validates the shipped manifests and reviewer case counts', () => {
    expect(validateRelease()).toMatchObject({ version: '0.4.4', positiveCases: 5, negativeCases: 3 });
  });
  test('records verified publication while preserving the historical receipt', () => {
    const root = fixture();
    const release = JSON.parse(readFileSync(join(root, 'distribution/release.json')));
    expect(release.package.version).toBe('0.4.3');
    expect(release.package.releaseUrl).toEndWith('/v0.4.3');
    expect(release.package.releaseCommit).toBe('97d3fdcc33633d0337d0abd0b690969fef421244');
    expect(release.package.validation).toMatchObject({ releaseWorkflow: 'passed', releaseWorkflowRun: 37958645378, releaseAssetsReconciled: true });
    expect(release.history[1].package.version).toBe('0.4.1');
    expect(release.history[1].package.releaseUrl).toEndWith('/v0.4.1');
    expect(release.history[1].package.publicSourceSnapshot).toBe('4ef1bca2509fd34f1840ee1501955f94a82f83e2');
    expect(release.history[1].readiness.authenticatedReadinessFailure).toBe('credential-missing');
    expect(release.history[0].package.version).toBe('0.4.2');
    expect(release.history[0].package.releaseCommit).toBe('835f9e74a5d9be475742bc3070de522d5a58bedd');
    expect(release.candidate).toEqual({ version: '0.4.4', status: 'prepared' });
    expect(release.readiness).toMatchObject({ authenticatedToolScanVerified: false, oauthConsentFlowVerified: false, reviewCasesExecuted: false, submissionReady: false });
  });
  test('rejects false candidate publication and nonadvancing preparation', () => {
    const root = fixture();
    alter(root, 'distribution/release.json', value => {
      value.package = value.history[0].package;
      value.candidate = { version: '0.4.4', status: 'prepared' };
    });
    alter(root, 'distribution/release.json', value => { value.candidate.status = 'published'; });
    expect(() => validateRelease(root)).toThrow('Candidate cannot claim publication');
    alter(root, 'distribution/release.json', value => { value.candidate.status = 'prepared'; value.candidate.version = '0.4.5'; });
    expect(() => validateRelease(root)).toThrow('Distribution candidate version drift');
    alter(root, 'distribution/release.json', value => { value.candidate.version = '0.4.4'; value.package.version = '0.4.4'; });
    expect(() => validateRelease(root)).toThrow('Candidate must advance');
  });
  test('rejects version drift across hosts', () => {
    const root = fixture();
    alter(root, 'plugins/freelaw-studio/.claude-plugin/plugin.json', (value) => { value.version = '0.3.0'; });
    expect(() => validateRelease(root)).toThrow('Release version drift');
  });
  test('ships Claude directory links and a valid square PNG icon', () => {
    const root = fixture();
    const plugin = join(root, 'plugins/freelaw-studio');
    const manifest = JSON.parse(
      readFileSync(join(plugin, '.claude-plugin/plugin.json'), 'utf8'),
    );
    expect(manifest).toMatchObject({
      icon: './assets/freelaw-icon.png',
      documentationUrl: 'https://freelaw.ai/developers',
      supportUrl: 'https://freelaw.ai/suporte',
      privacyPolicyUrl: 'https://freelaw.ai/politica-de-privacidade',
      termsOfServiceUrl: 'https://freelaw.ai/termos-de-uso',
    });
    for (const field of [
      'documentationUrl',
      'supportUrl',
      'privacyPolicyUrl',
      'termsOfServiceUrl',
    ]) {
      expect(new URL(manifest[field]).protocol).toBe('https:');
    }
    const icon = readFileSync(packagePath(plugin, manifest.icon));
    expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const width = icon.readUInt32BE(16);
    const height = icon.readUInt32BE(20);
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(48);
    expect(width).toBeLessThanOrEqual(4096);
    expect(icon.length).toBeLessThanOrEqual(5 * 1024 * 1024);
  });
  test('rejects credentials bundled in MCP configuration', () => {
    const root = fixture();
    alter(root, 'plugins/freelaw-studio/.mcp.json', (value) => { value.mcpServers['freelaw-studio'].headers = { Authorization: 'test-only' }; });
    expect(() => validateRelease(root)).toThrow('Bundled credentials');
  });
  test('rejects missing OAuth declaration, auth downgrade and bundled client credentials', () => {
    for (const auth of [undefined, { type: 'none' }, {
      type: 'oauth', client: { mode: 'provided', clientId: 'test-only', clientSecret: 'test-only' },
      baseScopes: ['office:read', 'office:write'],
    }, { type: 'oauth', client: { mode: 'dcr' }, baseScopes: ['office:read', 'admin:write'] }]) {
      const root = fixture();
      alter(root, 'plugins/freelaw-studio/mcp.json', value => {
        value.mcpServers['freelaw-studio'].extensions['com.openai'].auth = auth;
      });
      expect(() => validateRelease(root)).toThrow('credential-free OAuth DCR');
    }
  });
  test('requires referenced release assets and confines their paths', () => {
    const root = fixture();
    expect(() => packagePath(join(root, 'plugins/freelaw-studio'), './../../package.json')).toThrow('escapes');
    rmSync(join(root, 'plugins/freelaw-studio/assets/freelaw-icon.png'));
    expect(() => validateRelease(root)).toThrow('Missing packaged file');
  });
  test('requires successful durable runs for future authenticated readiness claims', () => {
    const root = fixture();
    alter(root, 'distribution/release.json', (value) => {
      value.readiness.authenticatedToolScanVerified = true;
      value.readiness.authenticatedReadinessFailure = 'credential-missing';
      value.readiness.authenticatedReadinessRun = 36826356633;
    });
    expect(() => validateRelease(root)).toThrow('cannot retain a failure receipt');
    alter(root, 'distribution/release.json', (value) => {
      delete value.readiness.authenticatedReadinessFailure;
      value.readiness.oauthConsentFlowVerified = true;
      value.readiness.reviewCasesExecuted = true;
      value.readiness.submissionReady = true;
    });
    expect(() => validateRelease(root)).toThrow('authenticatedReadinessEvidence');
    alter(root, 'distribution/release.json', (value) => {
      value.readiness.authenticatedReadinessRun = 36829999999;
      const evidence = {
        receiptUrl: 'https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin/actions/runs/36829999999',
        recordedAt: '2026-10-01T15:00:00Z', sourceSha: 'a'.repeat(40),
        runId: 36829999999, conclusion: 'success',
      };
      value.readiness.authenticatedReadinessEvidence = evidence;
      value.readiness.oauthConsentEvidence = evidence;
      value.readiness.reviewCasesEvidence = evidence;
    });
    expect(() => validateRelease(root)).not.toThrow();
  });
  test('requires a durable receipt before a provider directory claim advances', () => {
    const root = fixture();
    alter(root, 'distribution/providers.json', (value) => {
      value.providers[0].directoryStatus = 'submitted';
    });
    expect(() => validateRelease(root)).toThrow('directoryEvidence');
    alter(root, 'distribution/providers.json', (value) => {
      value.providers[0].directoryEvidence = {
        receiptUrl: 'https://example.com/receipts/openai-submission.json',
        recordedAt: '2026-10-01T15:00:00Z',
        sourceSha: 'a'.repeat(40),
      };
    });
    expect(() => validateRelease(root)).not.toThrow();
  });
});

describe('release automation', () => {
  test('keeps PR validation secretless, actions pinned and provider states honest', () => {
    expect(validateCicd()).toEqual({ workflows: 3, providers: 5, actionsPinned: true });
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    expect(workflow).toMatch(
      /- name: Create or resume the draft GitHub Release\n\s+if: env\.RELEASE_STATE != 'published'[\s\S]*?gh release upload[^\n]*--clobber/,
    );
    expect(workflow).toMatch(
      /- name: Publish the verified release\n\s+if: env\.RELEASE_STATE != 'published'/,
    );
    expect(workflow).toContain('git show "$GITHUB_SHA:scripts/$helper"');
    expect(workflow).toContain('bun "$RELEASE_RUNTIME_DIR/reconcile-release-assets.mjs"');
    expect(workflow).toContain('bun "$RELEASE_RUNTIME_DIR/detect-release-state.mjs"');
  });

  test('distinguishes missing, draft and published releases without masking auth failures', () => {
    const calls = [];
    const classify = (result) => detectReleaseState({
      tag: 'v0.4.1',
      repository: 'Freelaw-S-A/freelaw-studio-agent-plugin',
      run: (args) => {
        calls.push(args);
        return result;
      },
    });
    expect(classify({ status: 1, stdout: '', stderr: 'release not found\n' })).toBe('missing');
    expect(calls[0]).toEqual([
      'release', 'view', 'v0.4.1', '--repo', 'Freelaw-S-A/freelaw-studio-agent-plugin',
      '--json', 'isDraft,tagName',
    ]);
    expect(classify({
      status: 0,
      stdout: JSON.stringify({ isDraft: true, tagName: 'v0.4.1' }),
      stderr: '',
    })).toBe('draft');
    expect(classify({
      status: 0,
      stdout: JSON.stringify({ isDraft: false, tagName: 'v0.4.1' }),
      stderr: '',
    })).toBe('published');
    expect(() => classify({ status: 1, stdout: '', stderr: 'HTTP 401: Bad credentials\n' })).toThrow(
      'HTTP 401',
    );
    expect(() => classify({ status: 1, stdout: '', stderr: 'HTTP 403: rate limit exceeded\n' })).toThrow(
      'HTTP 403',
    );
    expect(() => classify({ status: 1, stdout: '', stderr: 'HTTP 500: upstream unavailable\n' })).toThrow(
      'HTTP 500',
    );
  });

  test('loads workflow helpers from the trusted runtime commit while preserving old tagged source', () => {
    const root = mkdtempSync(join(tmpdir(), 'release-runtime-source-test-'));
    temporary.push(root);
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('config', 'user.name', 'Release Test');
    git('config', 'user.email', 'release-test@example.com');
    writeFileSync(join(root, 'package-source.txt'), 'tagged source\n');
    git('add', 'package-source.txt');
    git('commit', '-qm', 'tagged source');
    git('tag', 'v0.4.1');
    mkdirSync(join(root, 'scripts'));
    writeFileSync(join(root, 'scripts', 'runtime-helper.mjs'), "console.log('runtime helper')\n");
    git('add', 'scripts/runtime-helper.mjs');
    git('commit', '-qm', 'add runtime helper');
    const runtimeSha = git('rev-parse', 'HEAD');
    git('checkout', '-q', 'v0.4.1');
    expect(() => readFileSync(join(root, 'scripts', 'runtime-helper.mjs'))).toThrow();
    const runtimeDir = join(root, 'runner-temp');
    mkdirSync(runtimeDir);
    const helper = git('show', `${runtimeSha}:scripts/runtime-helper.mjs`);
    const helperPath = join(runtimeDir, 'runtime-helper.mjs');
    writeFileSync(helperPath, `${helper}\n`);

    expect(execFileSync('node', [helperPath], { encoding: 'utf8' }).trim()).toBe('runtime helper');
    expect(readFileSync(join(root, 'package-source.txt'), 'utf8')).toBe('tagged source\n');
    expect(git('rev-parse', 'HEAD')).toBe(git('rev-list', '-n', '1', 'v0.4.1'));
  });

  test('requires the package version, tag target and trusted main ancestry', () => {
    const sha = 'a'.repeat(40);
    const calls = [];
    const git = (args) => {
      calls.push(args.join(' '));
      if (args[0] === 'merge-base') return '';
      if (args.includes('origin/main')) return 'b'.repeat(40);
      return sha;
    };
    expect(verifyReleaseContext({
      tag: 'v0.4.4', eventName: 'workflow_dispatch', sourceRef: 'refs/heads/main', git,
    })).toMatchObject({ version: '0.4.4', tag: 'v0.4.4', head: sha, mainAncestorVerified: true });
    expect(calls).toContain(`merge-base --is-ancestor ${sha} origin/main`);
    expect(() => verifyReleaseContext({
      tag: 'v0.4.0', eventName: 'workflow_dispatch', sourceRef: 'refs/heads/main', git,
    })).toThrow('Tag must match package version');
    expect(() => verifyReleaseContext({
      tag: 'v0.4.4', eventName: 'workflow_dispatch', sourceRef: 'refs/heads/feature', git,
    })).toThrow('dispatched from main');
  });

  test('builds a provider handoff without claiming authenticated review or approval', () => {
    const sha = 'c'.repeat(40);
    const handoff = buildSubmissionHandoff({
      tag: 'v0.4.4',
      sha,
      releaseUrl: 'https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin/releases/tag/v0.4.4',
      checkedAt: '2026-09-30T00:00:00.000Z',
    });
    expect(handoff.review).toMatchObject({
      positiveCasesDeclared: 5,
      negativeCasesDeclared: 3,
      authenticatedCasesExecuted: false,
      approved: false,
    });
    expect(handoff.providers.map(({ submissionStatus }) => submissionStatus)).toEqual([
      'manual_required', 'manual_required', 'crawler_discovery', 'pull_request_supported', 'unverified',
    ]);
    expect(handoff.grokCatalogEntry.source.sha).toBe(sha);
    expect(handoff.grokCatalogEntry.source.path).toBe('plugins/freelaw-studio');
    expect(handoffMarkdown(handoff)).toContain('manual_required');
    expect(JSON.stringify(handoff)).not.toMatch(/"(?:token|password|secret)"\s*:/i);
  });

  test('reuses immutable published receipts only after every hash and the rebuilt ZIP match', () => {
    const root = mkdtempSync(join(tmpdir(), 'published-release-test-'));
    temporary.push(root);
    const builtDir = join(root, 'built');
    const publishedDir = join(root, 'published');
    mkdirSync(builtDir);
    mkdirSync(publishedDir);
    const version = '0.4.1';
    const releaseSha = 'c'.repeat(40);
    const archive = `freelaw-studio-${version}.zip`;
    const readiness = `mcp-readiness-${version}.json`;
    const handoffJson = `submission-handoff-${version}.json`;
    const handoffMarkdown = `submission-handoff-${version}.md`;
    writeFileSync(join(builtDir, archive), 'reproduced archive');
    writeFileSync(join(publishedDir, archive), 'reproduced archive');
    writeFileSync(join(publishedDir, readiness), JSON.stringify({ packageVersion: version, checkedAt: 'published' }));
    writeFileSync(join(publishedDir, handoffJson), JSON.stringify({ release: { version, tag: `v${version}`, commit: releaseSha }, checkedAt: 'published' }));
    writeFileSync(join(publishedDir, handoffMarkdown), '# Published handoff\n');
    writeFileSync(join(builtDir, readiness), JSON.stringify({ packageVersion: version, checkedAt: 'rerun' }));
    const names = [archive, readiness, handoffJson, handoffMarkdown];
    const checksum = names.map((name) => {
      const hash = createHash('sha256').update(readFileSync(join(publishedDir, name))).digest('hex');
      return `${hash}  ${name}`;
    }).join('\n');
    writeFileSync(join(publishedDir, `SHA256SUMS-${version}.txt`), `${checksum}\n`);

    expect(reconcileReleaseAssets({ version, releaseSha, builtDir, publishedDir })).toMatchObject({
      receiptsReused: true,
    });
    expect(JSON.parse(readFileSync(join(builtDir, readiness), 'utf8')).checkedAt).toBe('published');

    writeFileSync(join(publishedDir, archive), 'divergent published archive');
    expect(() => reconcileReleaseAssets({ version, releaseSha, builtDir, publishedDir })).toThrow(
      'Published hash diverges',
    );
    rmSync(join(publishedDir, readiness));
    expect(() => reconcileReleaseAssets({ version, releaseSha, builtDir, publishedDir })).toThrow(
      'Missing release asset',
    );
  });

  test('adds or updates one SHA-pinned entry in the Grok catalog', () => {
    const root = mkdtempSync(join(tmpdir(), 'grok-catalog-test-'));
    temporary.push(root);
    const catalog = join(root, 'marketplace.json');
    const entry = join(root, 'entry.json');
    writeFileSync(catalog, JSON.stringify({ name: 'xai', plugins: [{ name: 'another', source: { source: 'url', url: 'https://example.com/repo.git', sha: 'd'.repeat(40) } }] }));
    writeFileSync(entry, JSON.stringify({ name: 'freelaw-studio', source: { source: 'url', url: 'https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin.git', sha: 'e'.repeat(40) } }));
    const run = () => execFileSync('python3', [
      'scripts/update-grok-catalog.py', '--catalog', catalog, '--entry', entry,
    ]);
    run();
    run();
    const plugins = JSON.parse(readFileSync(catalog, 'utf8')).plugins;
    expect(plugins.map(({ name }) => name)).toEqual(['another', 'freelaw-studio']);
    expect(plugins.filter(({ name }) => name === 'freelaw-studio')).toHaveLength(1);
  });
});

const origin = 'https://app.freelaw.ai';
function transport({ badResource = false, oauthEnabled = true, challenge = true, annotations = true, governedWrites } = {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/api/agent/status')) return Response.json({ authentication: { oauth: { enabled: oauthEnabled } }, surfaces: [{ id: 'oauth', status: 'available' }], capabilities: { governedWrites } });
    if (url.endsWith('/.well-known/oauth-protected-resource')) return Response.json({ resource: badResource ? 'https://other.example/mcp' : `${origin}/api/agent/mcp`, authorization_servers: [origin] });
    if (url.endsWith('/.well-known/oauth-authorization-server')) return Response.json({ issuer: origin, code_challenge_methods_supported: ['S256'], authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/oauth/token`, registration_endpoint: `${origin}/oauth/register` });
    if (!options.headers?.Authorization) return new Response(null, { status: 401, headers: challenge ? { 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` } : {} });
    const { method, id } = JSON.parse(options.body);
    return Response.json({ jsonrpc: '2.0', id, result: method === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'freelaw', version: '1.0.0' } } : { tools: [{ name: 'office__permissions__describe', inputSchema: { type: 'object' }, description: 'Describe granted office permissions.', annotations: annotations ? { readOnlyHint: true, destructiveHint: false, openWorldHint: false } : { readOnlyHint: true } }] } });
  } };
}
describe('submission evidence', () => {
  test('reports missing approval signing without failing public discovery or exposing status extras', async () => {
    const receipt = await checkMcpReadiness(transport({ governedWrites: {
      status: 'unavailable', approvalSigningConfigured: false,
      blockers: ['private-provider-error'], secret: 'must-not-project',
    } }));
    expect(receipt).toMatchObject({ publicTransportVerified: true, submissionReady: false,
      governedWrites: { status: 'unavailable', approvalSigningConfigured: false, blockers: ['approval_signing_not_configured'] },
    });
    expect(receipt.blockers[0]).toContain('authorized operator');
    expect(JSON.stringify(receipt)).not.toContain('private-provider-error');
    expect(JSON.stringify(receipt)).not.toContain('must-not-project');
  });
  test('signer presence and an authenticated catalog do not prove an approved persisted write', async () => {
    const receipt = await checkMcpReadiness({ ...transport({ governedWrites: {
      status: 'requires_authenticated_verification', approvalSigningConfigured: true,
    } }), token: 'fixture-token' });
    expect(receipt).toMatchObject({ authenticatedToolScanVerified: true, submissionReady: false,
      governedWrites: { status: 'requires_authenticated_verification', approvalSigningConfigured: true, blockers: ['approved_write_not_verified'] },
    });
    expect(receipt.blockers[0]).toContain('idempotent retry');
  });
  test('absent, malformed, contradictory or unrecognized signing evidence remains unknown', async () => {
    for (const governedWrites of [undefined, null, [], 'private-provider-error', {},
      { status: 'unavailable', approvalSigningConfigured: true },
      { status: 'requires_authenticated_verification', approvalSigningConfigured: false },
      { status: 'requires_authenticated_verification', approvalSigningConfigured: 'true' },
      { status: 'verified', approvalSigningConfigured: true },
    ]) {
      const receipt = await checkMcpReadiness(transport({ governedWrites }));
      expect(receipt.governedWrites).toEqual({ status: 'unknown', approvalSigningConfigured: null, blockers: ['approval_signing_configuration_unknown'] });
      expect(receipt.submissionReady).toBe(false);
      expect(JSON.stringify(receipt)).not.toContain('private-provider-error');
    }
  });
  test('public discovery does not claim authenticated or review readiness', async () => {
    const mock = transport();
    const receipt = await checkMcpReadiness(mock);
    expect(receipt).toMatchObject({ publicTransportVerified: true, authenticatedToolScanVerified: false, submissionReady: false, reviewCasesExecuted: false });
    expect(mock.calls.every(({ options }) => !options.headers?.Authorization)).toBe(true);
  });
  test('rejects discovery for another service and unavailable OAuth', async () => {
    await expect(checkMcpReadiness(transport({ badResource: true }))).rejects.toThrow('not bound');
    await expect(checkMcpReadiness(transport({ oauthEnabled: false }))).rejects.toThrow('unavailable');
  });
  test('requires an actual OAuth challenge', async () => {
    await expect(checkMcpReadiness(transport({ challenge: false }))).rejects.toThrow('challenge');
  });
  test('authenticated requests forbid redirects before a credential can leave the service', async () => {
    const mock = transport();
    await checkMcpReadiness({ ...mock, token: 'fixture-token' });
    expect(mock.calls.every(({ options }) => options.redirect === 'error')).toBe(true);
  });
  test('rejects invalid RPC envelopes, handshakes and incomplete or unusable catalogs', async () => {
    const mutations = [
      body => { body.id = 999; },
      body => { body.jsonrpc = '1.0'; },
      body => { body.error = { code: -32603, message: 'private-office-data' }; },
      body => { if (body.result.serverInfo) body.result.protocolVersion = 'unknown'; },
      body => { if (body.result.serverInfo) delete body.result.capabilities.tools; },
      body => { if (body.result.serverInfo) body.result.serverInfo.version = ''; },
      body => { if (body.result.tools) body.result.nextCursor = 'more'; },
      body => { if (body.result.tools) delete body.result.tools[0].inputSchema; },
      body => { if (body.result.tools) body.result.tools[0].inputSchema.type = 'array'; },
      body => { if (body.result.tools) body.result.tools.push(body.result.tools[0]); },
      body => { if (body.result.tools) body.result.tools[0].name = 'office__invalid.tool'; },
      body => { if (body.result.tools) body.result.tools[0].description = 123; },
    ];
    for (const mutate of mutations) {
      const mock = transport();
      await expect(checkMcpReadiness({
        token: 'fixture-token',
        fetchImpl: async (url, options) => {
          const response = await mock.fetchImpl(url, options);
          if (!options.headers?.Authorization) return response;
          const body = await response.json();
          mutate(body);
          return Response.json(body);
        },
      })).rejects.toThrow();
    }
  });
  test('authenticated catalog checks require all annotations and do not publish the credential', async () => {
    const mock = transport();
    const receipt = await checkMcpReadiness({ ...mock, token: 'fixture-token' });
    expect(receipt).toMatchObject({ authenticatedToolScanVerified: true, toolCount: 1, submissionReady: false });
    expect(JSON.stringify(receipt)).not.toContain('fixture-token');
    await expect(checkMcpReadiness({ ...transport({ annotations: false }), token: 'fixture-token' })).rejects.toThrow('annotations');
  });
});
