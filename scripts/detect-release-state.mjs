import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function ghReleaseView(args) {
  return spawnSync('gh', args, { encoding: 'utf8' });
}

export function detectReleaseState({ tag, repository, run = ghReleaseView }) {
  assert.match(tag, /^v\d+\.\d+\.\d+$/, 'Release tag must be semver');
  assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Repository must be owner/name');
  const result = run([
    'release',
    'view',
    tag,
    '--repo',
    repository,
    '--json',
    'isDraft,tagName',
  ]);
  if (result.error) throw result.error;
  if (result.status === 0) {
    const release = JSON.parse(result.stdout);
    assert.equal(release.tagName, tag, 'GitHub returned a different release tag');
    assert.equal(typeof release.isDraft, 'boolean', 'GitHub omitted the draft state');
    return release.isDraft ? 'draft' : 'published';
  }
  const message = `${result.stderr ?? ''}`.trim();
  if (result.status === 1 && /^release not found$/i.test(message)) return 'missing';
  throw new Error(`Unable to inspect GitHub Release (status ${result.status ?? 'unknown'}): ${message}`);
}

function option(name) {
  const index = process.argv.indexOf(name);
  assert(index >= 0 && process.argv[index + 1], `Missing ${name}`);
  return process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(detectReleaseState({ tag: option('--tag'), repository: option('--repo') }));
}
