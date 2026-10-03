import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDistributionDocuments } from './distribution-contract.mjs';

export function packagePath(root, relative) {
  assert(relative.startsWith('./'), 'Package paths must start with ./');
  const target = resolve(root, relative);
  assert(target.startsWith(`${resolve(root)}${sep}`), 'Package path escapes the plugin');
  assert(existsSync(target), `Missing packaged file: ${relative}`);
  return target;
}

export function validateRelease(root = process.cwd()) {
  const plugin = resolve(root, 'plugins/freelaw-studio');
  const json = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  const portable = json('plugins/freelaw-studio/plugin.json');
  const codex = json('plugins/freelaw-studio/.codex-plugin/plugin.json');
  const release = json('distribution/release.json');
  const providers = json('distribution/providers.json');
  const version = portable.version;
  for (const path of ['package.json', 'gemini-extension.json', 'plugins/freelaw-studio/gemini-extension.json', 'plugins/freelaw-studio/.claude-plugin/plugin.json', 'plugins/freelaw-studio/.codex-plugin/plugin.json', 'plugins/freelaw-studio/.grok-plugin/plugin.json']) {
    assert.equal(json(path).version, version, `Release version drift: ${path}`);
  }
  if (release.candidate) {
    assert.equal(release.candidate.status, 'prepared', 'Candidate cannot claim publication');
    assert.equal(release.candidate.version, version, 'Distribution candidate version drift');
    assert.match(version, /^\d+\.\d+\.\d+$/, 'Candidate must use a release version');
    assert(version.localeCompare(release.package.version, 'en', { numeric: true }) > 0, 'Candidate must advance the published version');
  } else {
    assert.equal(release.package.version, version, 'Distribution release version drift');
  }
  validateDistributionDocuments(release, providers);
  assert.deepEqual(codex.interface, portable.extensions['com.openai'].interface);
  const metadata = codex.interface;
  assert(metadata.displayName.length <= 30 && metadata.shortDescription.length <= 30);
  assert(metadata.defaultPrompt.length <= 3 && metadata.defaultPrompt.every((prompt) => prompt.length <= 128));
  for (const field of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    const url = new URL(metadata[field]);
    assert(url.protocol === 'https:' && !url.username && !url.password, `Invalid public URL: ${field}`);
  }
  for (const field of ['composerIcon', 'logo']) {
    const icon = readFileSync(packagePath(plugin, metadata[field]));
    assert(icon.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    const width = icon.readUInt32BE(16), height = icon.readUInt32BE(20);
    assert(width === height && width >= 48 && width <= 4096 && icon.length <= 5 * 1024 * 1024);
  }
  const review = portable.extensions['com.openai'].review;
  assert.deepEqual(review, codex.extensions['com.openai'].review);
  assert.equal(review.test_cases.positive.length, 5);
  assert.equal(review.test_cases.negative.length, 3);
  for (const test of review.test_cases.positive) {
    for (const field of ['description', 'prompt', 'tools_triggered', 'expected_behavior']) assert(test[field]?.trim());
  }
  assert(!('test_credentials' in review) && !('reviewer_instructions' in review));
  packagePath(plugin, portable.extensions['com.openai'].onboardingSkill);
  for (const file of ['plugins/freelaw-studio/mcp.json', 'plugins/freelaw-studio/.mcp.json', 'plugins/freelaw-studio/gemini-extension.json', 'gemini-extension.json']) {
    const servers = json(file).mcpServers;
    assert.deepEqual(Object.keys(servers), ['freelaw-studio']);
    assert.equal(servers['freelaw-studio'].url ?? servers['freelaw-studio'].httpUrl, 'https://app.freelaw.ai/api/agent/mcp');
    assert(!servers['freelaw-studio'].headers && !servers['freelaw-studio'].env, 'Bundled credentials are forbidden');
  }
  const marketplace = json('.claude-plugin/marketplace.json');
  assert.equal(marketplace.plugins[0].source, './plugins/freelaw-studio');
  assert.equal(marketplace.plugins[0].name, portable.name);
  assert(existsSync(resolve(plugin, 'LICENSE')));
  for (const forbidden of ['hooks', 'hooks.json', '.env', '.app.json']) assert(!existsSync(resolve(plugin, forbidden)), `Forbidden release component: ${forbidden}`);
  return { version, plugin: portable.name, positiveCases: 5, negativeCases: 3 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validateRelease()));
}
