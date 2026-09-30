import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRelease } from './validate-release.mjs';

function argument(name, args = process.argv.slice(2)) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function buildSubmissionHandoff({ root = process.cwd(), tag, sha, releaseUrl, checkedAt } = {}) {
  const release = validateRelease(root);
  assert.equal(tag, `v${release.version}`, 'Handoff tag does not match package version');
  assert.match(sha ?? '', /^[a-f0-9]{40}$/, 'Handoff requires a full lowercase commit SHA');
  assert.equal(new URL(releaseUrl).protocol, 'https:');
  const matrix = JSON.parse(readFileSync(resolve(root, 'distribution/providers.json'), 'utf8'));
  const assetBase = `freelaw-studio-${release.version}`;
  return {
    schemaVersion: '1.0.0',
    checkedAt: checkedAt ?? new Date().toISOString(),
    release: {
      version: release.version,
      tag,
      commit: sha,
      releaseUrl,
      packageAsset: `${assetBase}.zip`,
      readinessAsset: `mcp-readiness-${release.version}.json`,
      checksumAsset: `SHA256SUMS-${release.version}.txt`,
    },
    review: {
      positiveCasesDeclared: release.positiveCases,
      negativeCasesDeclared: release.negativeCases,
      authenticatedCasesExecuted: false,
      approved: false,
      note: 'Release automation does not execute host review cases or prove directory approval.',
    },
    providers: matrix.providers,
    grokCatalogEntry: {
      name: 'freelaw-studio',
      description: 'Freelaw Studio law-office workflows through hosted MCP and OAuth.',
      category: 'productivity',
      source: {
        source: 'url',
        url: 'https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin.git',
        sha,
        path: 'plugins/freelaw-studio',
      },
      homepage: 'https://freelaw.ai/developers',
      keywords: ['freelaw', 'freelaw studio', 'freelaw mcp'],
      domains: ['freelaw.ai', 'www.freelaw.ai', 'app.freelaw.ai'],
    },
  };
}

export function handoffMarkdown(handoff) {
  const rows = handoff.providers.map((provider) =>
    `| ${provider.name} | ${provider.submissionStatus} | ${provider.automation} | [official source](${provider.officialSource}) |`,
  );
  return [
    `# Freelaw Studio ${handoff.release.version} submission handoff`,
    '',
    `Release: ${handoff.release.releaseUrl}`,
    `Commit: \`${handoff.release.commit}\``,
    '',
    '| Provider | Status | Automation | Source |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    'Authenticated review cases have not been executed by this workflow. Directory submission and approval remain separate external states.',
    '',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const handoff = buildSubmissionHandoff({
    tag: argument('--tag'),
    sha: argument('--sha'),
    releaseUrl: argument('--release-url'),
  });
  const output = argument('--output');
  const markdown = argument('--markdown');
  assert(output && markdown, '--output and --markdown are required');
  writeFileSync(resolve(output), `${JSON.stringify(handoff, null, 2)}\n`);
  writeFileSync(resolve(markdown), handoffMarkdown(handoff));
  console.log(JSON.stringify({ output, markdown, providers: handoff.providers.length }));
}
