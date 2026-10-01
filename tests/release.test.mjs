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
    expect(validateCicd()).toEqual({ workflows: 3, providers: 4, actionsPinned: true });
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
