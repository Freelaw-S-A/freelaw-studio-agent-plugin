import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://app.freelaw.ai';
const SERVER = `${ORIGIN}/api/agent/mcp`;
const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Project only known scalar evidence. Never echo provider fields or raw blockers.
export function governedWriteReadiness(value) {
  if (record(value) && value.status === 'unavailable' && value.approvalSigningConfigured === false) {
    return { status: 'unavailable', approvalSigningConfigured: false, blockers: ['approval_signing_not_configured'] };
  }
  if (record(value) && value.status === 'requires_authenticated_verification' && value.approvalSigningConfigured === true) {
    return { status: 'requires_authenticated_verification', approvalSigningConfigured: true, blockers: ['approved_write_not_verified'] };
  }
  return { status: 'unknown', approvalSigningConfigured: null, blockers: ['approval_signing_configuration_unknown'] };
}

async function rpcResult(response, id) {
  if (!response.ok) throw new Error('Authenticated MCP request failed');
  const body = await response.json();
  if (!record(body) || body.jsonrpc !== '2.0' || body.id !== id
    || 'error' in body || !record(body.result)) throw new Error('Invalid authenticated MCP response');
  return body.result;
}

export async function checkMcpReadiness({ fetchImpl = fetch, token } = {}) {
  const get = async (path) => {
    const response = await fetchImpl(`${ORIGIN}${path}`, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (!response.ok) throw new Error(`Public discovery failed: ${path} (${response.status})`);
    return response.json();
  };
  const [status, authorization, resource] = await Promise.all([
    get('/api/agent/status'), get('/.well-known/oauth-authorization-server'), get('/.well-known/oauth-protected-resource'),
  ]);
  if (status.authentication?.oauth?.enabled !== true || !status.surfaces?.some((surface) => surface.id === 'oauth' && surface.status === 'available')) throw new Error('OAuth is unavailable');
  if (resource.resource !== SERVER || !resource.authorization_servers?.includes(ORIGIN)) throw new Error('Protected resource is not bound to the Office MCP');
  if (authorization.issuer !== ORIGIN || !authorization.code_challenge_methods_supported?.includes('S256')) throw new Error('PKCE S256 discovery is missing');
  for (const field of ['authorization_endpoint', 'token_endpoint', 'registration_endpoint']) {
    const url = new URL(authorization[field]);
    if (url.origin !== ORIGIN || url.username || url.password) throw new Error('OAuth endpoint leaves the configured service');
  }
  const post = (method, id, params, credential) => fetchImpl(SERVER, {
    method: 'POST', signal: AbortSignal.timeout(15_000), redirect: 'error',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
  });
  const initialization = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'freelaw-release-check', version: PACKAGE_VERSION } };
  const unauthorized = await post('initialize', 1, initialization);
  if (unauthorized.status !== 401 || !unauthorized.headers.get('WWW-Authenticate')?.includes(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`)) throw new Error('OAuth authentication challenge is missing');
  const governedWrites = governedWriteReadiness(status.capabilities?.governedWrites);
  let authenticatedToolScanVerified = false, toolCount = null;
  if (token) {
    const initialized = await post('initialize', 2, initialization, token);
    const initializationResult = await rpcResult(initialized, 2);
    if (initializationResult.protocolVersion !== initialization.protocolVersion
      || !nonemptyString(initializationResult.serverInfo?.name)
      || !nonemptyString(initializationResult.serverInfo?.version)
      || !record(initializationResult.capabilities?.tools)) throw new Error('Authenticated initialization failed');
    const listed = await post('tools/list', 3, undefined, token);
    const catalog = await rpcResult(listed, 3);
    if (catalog.nextCursor !== undefined) throw new Error('Authenticated catalog is incomplete');
    const tools = catalog.tools;
    if (!Array.isArray(tools) || !tools.length) throw new Error('Authenticated catalog is unavailable');
    const names = new Set();
    for (const tool of tools) {
      if (!record(tool) || !nonemptyString(tool.name) || !/^office__[A-Za-z0-9_-]+$/.test(tool.name)
        || tool.name.length > 128 || names.has(tool.name) || !nonemptyString(tool.description)
        || !record(tool.inputSchema) || tool.inputSchema.type !== 'object') throw new Error('Unexpected public tool metadata');
      names.add(tool.name);
      for (const key of ['readOnlyHint', 'destructiveHint', 'openWorldHint']) if (typeof tool.annotations?.[key] !== 'boolean') throw new Error('Explicit tool annotations are missing');
    }
    authenticatedToolScanVerified = true; toolCount = tools.length;
  }
  return {
    checkedAt: new Date().toISOString(), packageVersion: PACKAGE_VERSION, serverUrl: SERVER,
    publicTransportVerified: true, authenticatedToolScanVerified, toolCount, governedWrites,
    oauthConsentFlowVerified: false, reviewCasesExecuted: false, submissionReady: false,
    blockers: [
      governedWrites.status === 'unavailable'
        ? 'Provision the approval signer through the authorized operator before testing governed writes.'
        : governedWrites.status === 'unknown'
          ? 'Verify the approval signer configuration; public status does not provide consistent evidence.'
          : 'Verify an approved, persisted write and its idempotent retry; signer presence alone is insufficient.',
      'Execute the five positive and three negative cases with the dedicated reviewer account.',
      'Record an accessible live walkthrough and supply reviewer access through the secure portal.',
      'Complete publisher/domain verification and portal review checks.',
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const receipt = await checkMcpReadiness({ token: process.env.FREELAW_REVIEW_MCP_TOKEN });
    const output = process.argv.indexOf('--output');
    if (output >= 0) writeFileSync(process.argv[output + 1], JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt, null, 2));
  } catch { console.error('MCP readiness failed. Check public discovery, authentication and tool metadata.'); process.exitCode = 1; }
}
