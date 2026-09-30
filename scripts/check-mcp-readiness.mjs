import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://app.freelaw.ai';
const SERVER = `${ORIGIN}/api/agent/mcp`;
const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

export async function checkMcpReadiness({ fetchImpl = fetch, token } = {}) {
  const get = async (path) => {
    const response = await fetchImpl(`${ORIGIN}${path}`, { signal: AbortSignal.timeout(15_000) });
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
    method: 'POST', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
  });
  const initialization = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'freelaw-release-check', version: PACKAGE_VERSION } };
  const unauthorized = await post('initialize', 1, initialization);
  if (unauthorized.status !== 401 || !unauthorized.headers.get('WWW-Authenticate')?.includes(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`)) throw new Error('OAuth authentication challenge is missing');
  let authenticatedToolScanVerified = false, toolCount = null;
  if (token) {
    const initialized = await post('initialize', 2, initialization, token);
    if (!initialized.ok || !(await initialized.json()).result?.serverInfo) throw new Error('Authenticated initialization failed');
    const listed = await post('tools/list', 3, undefined, token);
    const body = listed.ok ? await listed.json() : null;
    const tools = body?.result?.tools;
    if (!Array.isArray(tools) || !tools.length) throw new Error('Authenticated catalog is unavailable');
    for (const tool of tools) {
      if (!tool.name?.startsWith('office__') || !tool.description?.trim()) throw new Error('Unexpected public tool metadata');
      for (const key of ['readOnlyHint', 'destructiveHint', 'openWorldHint']) if (typeof tool.annotations?.[key] !== 'boolean') throw new Error('Explicit tool annotations are missing');
    }
    authenticatedToolScanVerified = true; toolCount = tools.length;
  }
  return {
    checkedAt: new Date().toISOString(), packageVersion: PACKAGE_VERSION, serverUrl: SERVER,
    publicTransportVerified: true, authenticatedToolScanVerified, toolCount,
    oauthConsentFlowVerified: false, reviewCasesExecuted: false, submissionReady: false,
    blockers: ['Execute the five positive and three negative cases with the dedicated reviewer account.', 'Record an accessible live walkthrough and supply reviewer access through the secure portal.', 'Complete publisher/domain verification and portal review checks.'],
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
