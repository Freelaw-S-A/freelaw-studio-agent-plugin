import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMcpReadiness, governedWriteReadiness } from './check-mcp-readiness.mjs';

const MODES = new Set(['public', 'catalog']);
const EXPECTED_SERVER_URL = 'https://app.freelaw.ai/api/agent/mcp';
const EXPECTED_PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

function baseReceipt(mode, now) {
  return {
    schemaVersion: '1.0.0',
    checkedAt: now().toISOString(),
    status: 'failed',
    mode,
    packageVersion: null,
    serverUrl: null,
    credentialConfigured: mode === 'public' ? null : false,
    publicTransportVerified: false,
    authenticatedToolScanVerified: false,
    toolCount: null,
    governedWrites: governedWriteReadiness(undefined),
    submissionReady: false,
    oauthConsentFlowVerified: false,
    reviewCasesExecuted: false,
    failureCode: 'readiness_check_failed',
  };
}

export async function runLiveReadiness({
  mode,
  token,
  check = checkMcpReadiness,
  now = () => new Date(),
} = {}) {
  if (!MODES.has(mode)) throw new Error('mode must be public or catalog');
  const receipt = baseReceipt(mode, now);
  const credential = typeof token === 'string' && token.trim().length > 0 ? token : undefined;
  if (mode === 'catalog') {
    receipt.credentialConfigured = Boolean(credential);
    if (!credential) return { ok: false, receipt };
  }
  try {
    const checked = await check(mode === 'catalog' ? { token: credential } : {});
    const publicTransportVerified = checked.publicTransportVerified === true;
    const authenticatedToolScanVerified = mode === 'catalog'
      && checked.authenticatedToolScanVerified === true;
    const toolCount = mode === 'catalog' && Number.isInteger(checked.toolCount)
      ? checked.toolCount
      : null;
    if (
      !publicTransportVerified
      || checked.packageVersion !== EXPECTED_PACKAGE_VERSION
      || checked.serverUrl !== EXPECTED_SERVER_URL
      || (mode === 'catalog' && (!authenticatedToolScanVerified || !toolCount || toolCount < 1))
    ) return { ok: false, receipt };
    return {
      ok: true,
      receipt: {
        ...receipt,
        status: 'passed',
        packageVersion: EXPECTED_PACKAGE_VERSION,
        serverUrl: EXPECTED_SERVER_URL,
        publicTransportVerified,
        authenticatedToolScanVerified,
        toolCount,
        governedWrites: governedWriteReadiness(checked.governedWrites),
        submissionReady: false,
        oauthConsentFlowVerified: false,
        reviewCasesExecuted: false,
        failureCode: null,
      },
    };
  } catch {
    return { ok: false, receipt };
  }
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = argument('--output');
  if (!output) throw new Error('--output is required');
  const result = await runLiveReadiness({
    mode: argument('--mode'),
    token: process.env.FREELAW_REVIEW_MCP_TOKEN,
  });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result.receipt, null, 2)}\n`);
  if (result.ok) {
    console.log('Sanitized MCP live readiness receipt written.');
  } else {
    console.error('MCP live readiness failed; sanitized receipt written.');
    process.exitCode = 1;
  }
}
