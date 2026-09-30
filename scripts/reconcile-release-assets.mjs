import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function requiredAssets(version) {
  return {
    archive: `freelaw-studio-${version}.zip`,
    readiness: `mcp-readiness-${version}.json`,
    handoffJson: `submission-handoff-${version}.json`,
    handoffMarkdown: `submission-handoff-${version}.md`,
    checksums: `SHA256SUMS-${version}.txt`,
  };
}

function requireFile(directory, name) {
  const path = join(directory, name);
  assert(existsSync(path) && statSync(path).isFile(), `Missing release asset: ${name}`);
  return path;
}

function parseChecksums(path, expectedNames) {
  const entries = new Map();
  for (const line of readFileSync(path, 'utf8').trim().split('\n')) {
    const match = /^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);
    assert(match, `Invalid checksum line: ${line}`);
    assert(!entries.has(match[2]), `Duplicate checksum entry: ${match[2]}`);
    entries.set(match[2], match[1]);
  }
  assert.deepEqual([...entries.keys()].sort(), [...expectedNames].sort(), 'Checksum asset set diverges');
  return entries;
}

export function reconcileReleaseAssets({ version, releaseSha, builtDir, publishedDir }) {
  assert.match(version, /^\d+\.\d+\.\d+$/, 'Version must be semver');
  assert.match(releaseSha, /^[a-f0-9]{40}$/, 'Release SHA must be a full commit SHA');
  const built = resolve(builtDir);
  const published = resolve(publishedDir);
  const assets = requiredAssets(version);
  const contentNames = [assets.archive, assets.readiness, assets.handoffJson, assets.handoffMarkdown];
  const publishedPaths = Object.fromEntries(
    Object.entries(assets).map(([key, name]) => [key, requireFile(published, name)]),
  );
  const checksums = parseChecksums(publishedPaths.checksums, contentNames);

  for (const name of contentNames) {
    assert.equal(digest(requireFile(published, name)), checksums.get(name), `Published hash diverges: ${name}`);
  }
  assert.equal(
    digest(requireFile(built, assets.archive)),
    checksums.get(assets.archive),
    'Reproduced ZIP diverges from the published release',
  );

  const readiness = JSON.parse(readFileSync(publishedPaths.readiness, 'utf8'));
  assert.equal(readiness.packageVersion, version, 'Readiness receipt version diverges');
  const handoff = JSON.parse(readFileSync(publishedPaths.handoffJson, 'utf8'));
  assert.equal(handoff.release?.version, version, 'Handoff version diverges');
  assert.equal(handoff.release?.tag, `v${version}`, 'Handoff tag diverges');
  assert.equal(handoff.release?.commit, releaseSha, 'Handoff release commit diverges');

  for (const name of [assets.readiness, assets.handoffJson, assets.handoffMarkdown, assets.checksums]) {
    copyFileSync(join(published, name), join(built, name));
  }
  return { version, assets: Object.values(assets), receiptsReused: true };
}

function option(name) {
  const index = process.argv.indexOf(name);
  assert(index >= 0 && process.argv[index + 1], `Missing ${name}`);
  return process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = reconcileReleaseAssets({
    version: option('--version'),
    releaseSha: option('--sha'),
    builtDir: option('--built-dir'),
    publishedDir: option('--published-dir'),
  });
  console.log(JSON.stringify(result));
}
