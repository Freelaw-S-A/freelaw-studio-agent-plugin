const SERVER = 'https://app.freelaw.ai/api/agent/mcp';
const READS = new Set(['permissions.describe', 'dailySummary.get', 'clients.list', 'clients.get', 'tasks.list', 'tasks.get', 'publications.list', 'publications.get']);
export const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

async function boundedJson(response) {
  if (!response.ok || !response.body) throw new Error('transport_failed');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) throw new Error('transport_failed');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}

// Only reads can reach the hosted endpoint. Simulation writes live elsewhere.
export function createReviewMcpTransport({ token, fetchImpl = fetch }) {
  if (typeof token !== 'string' || !token || token.length > 8192 || /\s/.test(token)) throw new Error('credential_required');
  let sequence = 0;
  const correlations = new Set();
  async function rpc(method, params) {
    const id = ++sequence;
    const response = await fetchImpl(SERVER, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
    });
    const correlation = response.headers.get('x-correlation-id');
    if (uuid(correlation)) correlations.add(correlation);
    const body = await boundedJson(response);
    if (!record(body) || body.jsonrpc !== '2.0' || body.id !== id || 'error' in body || !record(body.result)) throw new Error('transport_failed');
    const info = body.result._meta?.['io.modelcontextprotocol/serverInfo'];
    if (body.result.resultType !== 'complete' || info?.name !== 'freelaw-office-actions' || info.version !== '1.0.0') throw new Error('transport_failed');
    return body.result;
  }
  return {
    kind: 'direct-mcp',
    correlationIds: () => [...correlations].slice(0, 32),
    async initialize() {
      const result = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'freelaw-review-kit', version: '1' } });
      if (result.protocolVersion !== '2025-06-18' || !record(result.capabilities?.tools)) throw new Error('transport_failed');
    },
    async catalog() {
      const result = await rpc('tools/list');
      if (!Array.isArray(result.tools) || result.tools.length > 512 || result.nextCursor !== undefined) throw new Error('transport_failed');
      const seen = new Set();
      for (const tool of result.tools) {
        if (!record(tool) || typeof tool.name !== 'string' || !/^office__[A-Za-z0-9_-]{1,120}$/.test(tool.name) || seen.has(tool.name) || typeof tool.annotations?.readOnlyHint !== 'boolean') throw new Error('transport_failed');
        seen.add(tool.name);
      }
      return result.tools;
    },
    async call(action, args = {}) {
      if (!READS.has(action)) throw new Error('live_write_forbidden');
      const result = await rpc('tools/call', { name: `office__${action.replaceAll('.', '__')}`, arguments: args });
      if (result.isError === true || (result.isError !== undefined && result.isError !== false)) throw new Error('tool_failed');
      if (!Array.isArray(result.content) || result.content.length !== 1 || result.content[0].type !== 'text') throw new Error('tool_failed');
      const output = JSON.parse(result.content[0].text);
      if (!record(output) || (result.structuredContent !== undefined && !isDeepStrictEqual(output, result.structuredContent))) throw new Error('tool_failed');
      return output;
    },
  };
}
import { isDeepStrictEqual } from 'node:util';
