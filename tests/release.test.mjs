import { afterEach, describe, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateRelease, packagePath } from '../scripts/validate-release.mjs';
import { checkMcpReadiness } from '../scripts/check-mcp-readiness.mjs';
import { validateCicd } from '../scripts/validate-cicd.mjs';
import { verifyReleaseContext } from '../scripts/verify-release-context.mjs';
import { buildSubmissionHandoff, handoffMarkdown } from '../scripts/build-submission-handoff.mjs';

const temporary = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'freelaw-plugin-test-'));
  temporary.push(root);
  for (const path of ['package.json', 'gemini-extension.json', '.claude-plugin', 'plugins']) cpSync(resolve(path), join(root, path), { recursive: true });
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
    expect(validateRelease()).toMatchObject({ version: '0.4.1', positiveCases: 5, negativeCases: 3 });
  });
  test('rejects version drift across hosts', () => {
    const root = fixture();
    alter(root, 'plugins/freelaw-studio/.claude-plugin/plugin.json', (value) => { value.version = '0.3.0'; });
    expect(() => validateRelease(root)).toThrow('Release version drift');
  });
  test('rejects credentials bundled in MCP configuration', () => {
    const root = fixture();
    alter(root, 'plugins/freelaw-studio/.mcp.json', (value) => { value.mcpServers['freelaw-studio'].headers = { Authorization: 'test-only' }; });
    expect(() => validateRelease(root)).toThrow('Bundled credentials');
  });
  test('requires referenced release assets and confines their paths', () => {
    const root = fixture();
    expect(() => packagePath(join(root, 'plugins/freelaw-studio'), './../../package.json')).toThrow('escapes');
    rmSync(join(root, 'plugins/freelaw-studio/assets/freelaw-icon.png'));
    expect(() => validateRelease(root)).toThrow('Missing packaged file');
  });
});

describe('release automation', () => {
  test('keeps PR validation secretless, actions pinned and provider states honest', () => {
    expect(validateCicd()).toEqual({ workflows: 2, providers: 4, actionsPinned: true });
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
      tag: 'v0.4.1', eventName: 'workflow_dispatch', sourceRef: 'refs/heads/main', git,
    })).toMatchObject({ version: '0.4.1', tag: 'v0.4.1', head: sha, mainAncestorVerified: true });
    expect(calls).toContain(`merge-base --is-ancestor ${sha} origin/main`);
    expect(() => verifyReleaseContext({
      tag: 'v0.4.0', eventName: 'workflow_dispatch', sourceRef: 'refs/heads/main', git,
    })).toThrow('Tag must match package version');
    expect(() => verifyReleaseContext({
      tag: 'v0.4.1', eventName: 'workflow_dispatch', sourceRef: 'refs/heads/feature', git,
    })).toThrow('dispatched from main');
  });

  test('builds a provider handoff without claiming authenticated review or approval', () => {
    const sha = 'c'.repeat(40);
    const handoff = buildSubmissionHandoff({
      tag: 'v0.4.1',
      sha,
      releaseUrl: 'https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin/releases/tag/v0.4.1',
      checkedAt: '2026-09-30T00:00:00.000Z',
    });
    expect(handoff.review).toMatchObject({
      positiveCasesDeclared: 5,
      negativeCasesDeclared: 3,
      authenticatedCasesExecuted: false,
      approved: false,
    });
    expect(handoff.providers.map(({ submissionStatus }) => submissionStatus)).toEqual([
      'manual_required', 'manual_required', 'pull_request_supported', 'unverified',
    ]);
    expect(handoff.grokCatalogEntry.source.sha).toBe(sha);
    expect(handoff.grokCatalogEntry.source.path).toBe('plugins/freelaw-studio');
    expect(handoffMarkdown(handoff)).toContain('manual_required');
    expect(JSON.stringify(handoff)).not.toMatch(/"(?:token|password|secret)"\s*:/i);
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
function transport({ badResource = false, oauthEnabled = true, challenge = true, annotations = true } = {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/api/agent/status')) return Response.json({ authentication: { oauth: { enabled: oauthEnabled } }, surfaces: [{ id: 'oauth', status: 'available' }] });
    if (url.endsWith('/.well-known/oauth-protected-resource')) return Response.json({ resource: badResource ? 'https://other.example/mcp' : `${origin}/api/agent/mcp`, authorization_servers: [origin] });
    if (url.endsWith('/.well-known/oauth-authorization-server')) return Response.json({ issuer: origin, code_challenge_methods_supported: ['S256'], authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/oauth/token`, registration_endpoint: `${origin}/oauth/register` });
    if (!options.headers?.Authorization) return new Response(null, { status: 401, headers: challenge ? { 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` } : {} });
    const method = JSON.parse(options.body).method;
    return Response.json({ jsonrpc: '2.0', result: method === 'initialize' ? { serverInfo: { name: 'freelaw' } } : { tools: [{ name: 'office__permissions__describe', description: 'Describe granted office permissions.', annotations: annotations ? { readOnlyHint: true, destructiveHint: false, openWorldHint: false } : { readOnlyHint: true } }] } });
  } };
}
describe('submission evidence', () => {
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
  test('authenticated catalog checks require all annotations and do not publish the credential', async () => {
    const mock = transport();
    const receipt = await checkMcpReadiness({ ...mock, token: 'fixture-token' });
    expect(receipt).toMatchObject({ authenticatedToolScanVerified: true, toolCount: 1, submissionReady: false });
    expect(JSON.stringify(receipt)).not.toContain('fixture-token');
    await expect(checkMcpReadiness({ ...transport({ annotations: false }), token: 'fixture-token' })).rejects.toThrow('annotations');
  });
});
