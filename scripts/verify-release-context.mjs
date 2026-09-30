import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRelease } from './validate-release.mjs';

function argument(name, args = process.argv.slice(2)) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function defaultGit(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function verifyReleaseContext({
  root = process.cwd(),
  tag,
  eventName,
  sourceRef,
  git = (args) => defaultGit(root, args),
} = {}) {
  const release = validateRelease(root);
  assert.equal(tag, `v${release.version}`, `Tag must match package version v${release.version}`);
  assert.match(tag, /^v\d+\.\d+\.\d+$/, 'Release tag must be strict semver');
  assert(['push', 'workflow_dispatch'].includes(eventName), 'Unsupported release event');
  if (eventName === 'push') assert.equal(sourceRef, `refs/tags/${tag}`, 'Tag releases must run from their tag');
  if (eventName === 'workflow_dispatch') assert.equal(sourceRef, 'refs/heads/main', 'Manual releases must be dispatched from main');

  const head = git(['rev-parse', 'HEAD']);
  const tagged = git(['rev-list', '-n', '1', `refs/tags/${tag}`]);
  assert.equal(head, tagged, 'Checked out commit does not match the release tag');
  git(['merge-base', '--is-ancestor', head, 'origin/main']);
  const main = git(['rev-parse', 'origin/main']);
  return { ...release, tag, head, main, mainAncestorVerified: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyReleaseContext({
    tag: argument('--tag'),
    eventName: argument('--event'),
    sourceRef: argument('--source-ref'),
  });
  console.log(JSON.stringify(result));
}
