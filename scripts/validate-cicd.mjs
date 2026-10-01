import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_PROVIDER_IDS = [
  'chatgpt-openai',
  'claude-anthropic',
  'grok-xai',
  'meta-muse-spark',
];

export function validateCicd(root = process.cwd()) {
  const read = (path) => readFileSync(resolve(root, path), 'utf8');
  const validation = read('.github/workflows/validate.yml');
  const release = read('.github/workflows/release.yml');
  const liveReadiness = read('.github/workflows/live-readiness.yml');
  const workflows = `${validation}\n${release}\n${liveReadiness}`;

  assert(!workflows.includes('pull_request_target'), 'pull_request_target is forbidden');
  for (const match of workflows.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)) {
    const reference = match[1];
    assert(
      /@[a-f0-9]{40}$/.test(reference),
      `GitHub Action must be pinned to a full commit SHA: ${reference}`,
    );
  }
  assert.match(validation, /pull_request:/, 'PR validation trigger is required');
  assert.match(validation, /permissions:\s*\n\s*contents:\s*read/, 'PR validation must be read-only');
  assert(!validation.includes('secrets.'), 'PR validation cannot reference repository secrets');
  assert.match(release, /workflow_dispatch:/, 'Release workflow must remain manually dispatchable');
  assert.match(release, /tags:\s*\n\s*- ['"]v\*\.\*\.\*['"]/, 'Release workflow must accept semver tags');
  assert.match(release, /contents:\s*write/, 'Release job needs contents: write for GitHub Releases');
  assert.match(release, /environment:\s*directory-submission/, 'External submission needs a protected environment');
  assert.match(release, /execute_grok_pr/, 'Grok PR execution must be an explicit manual input');
  assert.match(liveReadiness, /workflow_dispatch:/, 'Live readiness must be manually dispatched');
  assert(!/^\s*(?:pull_request|push):/m.test(liveReadiness), 'Live readiness cannot run on push or pull request');
  assert.match(liveReadiness, /if: github\.ref == 'refs\/heads\/main'/, 'Live readiness must be main-only');
  assert.match(liveReadiness, /permissions:\s*\n\s*contents:\s*read/, 'Live readiness must be read-only');
  assert(!/^\s*permissions:\s*write-all\s*$/m.test(liveReadiness), 'Live readiness cannot use write-all');
  assert(!/^\s*[a-z-]+:\s*write\s*$/m.test(liveReadiness), 'Live readiness cannot grant write permissions');
  assert.match(liveReadiness, /if: always\(\)[\s\S]*actions\/upload-artifact@[a-f0-9]{40}/, 'Live readiness must always upload a SHA-pinned artifact');
  assert.match(liveReadiness, /FREELAW_REVIEW_MCP_TOKEN:\s*\$\{\{ secrets\.FREELAW_REVIEW_MCP_TOKEN \}\}/, 'Catalog smoke must use the reviewer secret');
  assert(!validation.includes('FREELAW_REVIEW_MCP_TOKEN'), 'PR validation cannot use the reviewer secret');
  for (const forbidden of ['gh release', 'gh pr', 'git push', 'execute_grok_pr']) {
    assert(!liveReadiness.includes(forbidden), `Live readiness cannot mutate external state: ${forbidden}`);
  }

  const matrix = JSON.parse(read('distribution/providers.json'));
  assert.equal(matrix.schemaVersion, '1.0.0');
  assert.deepEqual(matrix.providers.map(({ id }) => id), EXPECTED_PROVIDER_IDS);
  for (const provider of matrix.providers) {
    assert(new URL(provider.officialSource).protocol === 'https:');
    assert(provider.reason?.trim(), `Missing provider reason: ${provider.id}`);
  }
  assert.equal(matrix.providers.find(({ id }) => id === 'chatgpt-openai').submissionStatus, 'manual_required');
  assert.equal(matrix.providers.find(({ id }) => id === 'claude-anthropic').submissionStatus, 'manual_required');
  assert.equal(matrix.providers.find(({ id }) => id === 'grok-xai').submissionStatus, 'pull_request_supported');
  assert.equal(matrix.providers.find(({ id }) => id === 'meta-muse-spark').submissionStatus, 'unverified');

  return { workflows: 3, providers: matrix.providers.length, actionsPinned: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validateCicd()));
}
