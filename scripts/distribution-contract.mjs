// Pure contract shared by the developer hub and public package validation.
export const EXPECTED_PROVIDER_IDS = [
  'chatgpt-openai', 'claude-anthropic', 'gemini-google', 'grok-xai', 'meta-muse-spark',
];
export const SUBMISSION_PROVIDER_IDENTITIES = Object.freeze({
  openai: EXPECTED_PROVIDER_IDS[0],
  claude: EXPECTED_PROVIDER_IDS[1],
});
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const SHA = /^[a-f0-9]{40}$/;
const REPOSITORY = 'https://github.com/Freelaw-S-A/freelaw-studio-agent-plugin';
const DIRECTORY_STATUSES = new Set(['not-submitted', 'not-verified', 'unverified', 'submitted', 'approved', 'published', 'rejected']);
const VALIDATION_STATUSES = new Set(['not-run', 'pending', 'failed', 'passed', 'verified']);
const POSITIVE_DIRECTORY_STATUSES = new Set(['submitted', 'approved', 'published']);
const POSITIVE_VALIDATION_STATUSES = new Set(['passed', 'verified']);

function invalid(label) { throw new Error(`Invalid agent plugin distribution ${label}`); }
function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(label);
  return value;
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) invalid(label);
  return value;
}
function httpsUrl(value, label) {
  let parsed;
  try { parsed = new URL(text(value, label)); } catch { invalid(label); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) invalid(label);
  return parsed.href;
}
function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) invalid(label);
  return value;
}
function durableEvidence(value, label) {
  const evidence = record(value, label);
  httpsUrl(evidence.receiptUrl, `${label}.receiptUrl`);
  if (!SHA.test(text(evidence.sourceSha, `${label}.sourceSha`))) invalid(`${label}.sourceSha`);
  const timestamp = text(evidence.recordedAt, `${label}.recordedAt`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) invalid(`${label}.recordedAt`);
  return evidence;
}

export function validateDistributionDocuments(releaseInput, providersInput) {
  const release = record(releaseInput, 'release document');
  const providers = record(providersInput, 'providers document');
  if (release.schemaVersion !== '1.0.0' || providers.schemaVersion !== '1.0.0') throw new Error('Unsupported agent plugin distribution schema');
  const packageRelease = record(release.package, 'release.package');
  const version = text(packageRelease.version, 'release.package.version');
  if (!SEMVER.test(version)) throw new Error('Invalid agent plugin distribution package semver');
  if (httpsUrl(packageRelease.pluginUrl, 'release.package.pluginUrl') !== REPOSITORY) invalid('release.package.pluginUrl');
  const releaseUrl = httpsUrl(packageRelease.releaseUrl, 'release.package.releaseUrl');
  if (releaseUrl !== `${REPOSITORY}/releases/tag/v${version}`) throw new Error('Agent plugin release URL does not match its package version');
  for (const field of ['releaseCommit', 'publicSourceSnapshot']) {
    if (!SHA.test(text(packageRelease[field], `release.package.${field}`))) invalid(`release.package.${field}`);
  }
  positiveInteger(packageRelease.mergedPullRequest, 'release.package.mergedPullRequest');

  const readiness = record(release.readiness, 'release.readiness');
  const flags = ['publicTransportVerified', 'authenticatedToolScanVerified', 'oauthConsentFlowVerified', 'reviewCasesExecuted', 'submissionReady'];
  for (const field of flags) if (typeof readiness[field] !== 'boolean') invalid(`release.readiness.${field}`);
  if (readiness.publicTransportVerified) positiveInteger(readiness.publicReadinessRun, 'release.readiness.publicReadinessRun');
  if (flags.slice(1).some(field => readiness[field])) {
    if (readiness.authenticatedReadinessFailure) throw new Error('Authenticated readiness cannot retain a failure receipt');
    const runId = positiveInteger(readiness.authenticatedReadinessRun, 'release.readiness.authenticatedReadinessRun');
    const evidence = durableEvidence(readiness.authenticatedReadinessEvidence, 'release.readiness.authenticatedReadinessEvidence');
    if (evidence.conclusion !== 'success' || evidence.runId !== runId) throw new Error('Authenticated readiness requires a matching successful run receipt');
    if (evidence.receiptUrl !== `${REPOSITORY}/actions/runs/${runId}`) invalid('release.readiness.authenticatedReadinessEvidence.receiptUrl');
  }
  for (const [flag, field] of [
    ['oauthConsentFlowVerified', 'oauthConsentEvidence'],
    ['reviewCasesExecuted', 'reviewCasesEvidence'],
  ]) {
    if (readiness[flag]) durableEvidence(readiness[field], `release.readiness.${field}`);
  }
  if (readiness.submissionReady && (!readiness.publicTransportVerified || !readiness.authenticatedToolScanVerified || !readiness.oauthConsentFlowVerified || !readiness.reviewCasesExecuted)) throw new Error('Submission readiness requires all authenticated review evidence');

  if (!Array.isArray(providers.providers)) invalid('providers');
  const ids = providers.providers.map((value, index) => text(record(value, `providers[${index}]`).id, `providers[${index}].id`));
  if (ids.length !== EXPECTED_PROVIDER_IDS.length || EXPECTED_PROVIDER_IDS.some((id, index) => ids[index] !== id)) throw new Error('Agent plugin provider order or membership drifted');
  for (const [index, value] of providers.providers.entries()) {
    const provider = record(value, `providers[${index}]`);
    for (const field of ['name', 'packageCompatibility', 'installationStatus', 'installationLabel', 'submissionStatus', 'directoryLabel', 'validationLabel', 'automation', 'reason']) text(provider[field], `providers[${index}].${field}`);
    httpsUrl(provider.officialSource, `providers[${index}].officialSource`);
    const directory = text(provider.directoryStatus, `providers[${index}].directoryStatus`);
    const validation = text(provider.authenticatedValidation, `providers[${index}].authenticatedValidation`);
    if (!DIRECTORY_STATUSES.has(directory)) invalid(`providers[${index}].directoryStatus`);
    if (!VALIDATION_STATUSES.has(validation)) invalid(`providers[${index}].authenticatedValidation`);
    if (POSITIVE_DIRECTORY_STATUSES.has(directory)) durableEvidence(provider.directoryEvidence, `providers[${index}].directoryEvidence`);
    if (POSITIVE_VALIDATION_STATUSES.has(validation)) durableEvidence(provider.validationEvidence, `providers[${index}].validationEvidence`);
  }
}
