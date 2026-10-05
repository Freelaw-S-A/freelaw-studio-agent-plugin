import { randomUUID } from 'node:crypto';
import { validateReviewFixtures } from './review-fixtures.mjs';

// In-memory behavior only: this adapter does not prove hosted governance or host AI.
export function createReviewSimulation(plan, { now = new Date() } = {}) {
  if (!validateReviewFixtures(plan, { now }).valid) throw new Error('invalid_fixture_plan');
  const bindings = { schemaVersion: 1, offices: { primary: randomUUID(), foreign: randomUUID() }, fixtures: Object.fromEntries(plan.fixtures.map((f) => [f.key, randomUUID()])) };
  const marker = `SYNTHETIC:${plan.campaign}`;
  const rows = plan.fixtures.map((f, index) => ({
    ...f, id: bindings.fixtures[f.key], full_name: `${marker} Client ${index}`, title: `${marker} Task ${index}`,
    status: 'pending', processId: f.refs.process ? bindings.fixtures[f.refs.process] : null,
    process_id: f.refs.process ? bindings.fixtures[f.refs.process] : null, client_id: f.refs.client ? bindings.fixtures[f.refs.client] : null,
    content: `${marker} Fictitious publication`, isRead: index % 2 === 0,
  }));
  // Assign distinct states regardless of fixture order.
  rows.filter((f) => f.type === 'publication' && f.office === 'primary').forEach((row, index) => { row.isRead = index % 2 === 0; });
  const adapter = (office, readOnly = false) => ({
    kind: 'simulation', correlationIds: () => [], initialize: async () => {},
    catalog: async () => [...['permissions.describe', 'dailySummary.get', 'clients.list', 'clients.get', 'tasks.list', 'tasks.get', 'publications.list', 'publications.get'], ...(!readOnly ? ['clients.create'] : [])].map((name) => ({ name: `office__${name.replaceAll('.', '__')}`, annotations: { readOnlyHint: name !== 'clients.create' } })),
    async call(name, args = {}) {
      const accessible = rows.filter((row) => row.office === office);
      const page = (field, values) => ({ [field]: values, count: values.length, total: values.length, limit: args.limit, offset: args.offset ?? 0 });
      if (name === 'permissions.describe') return { organizationId: bindings.offices[office], allowedActions: (await this.catalog()).map((tool) => tool.name.replace('office__', 'office.').replaceAll('__', '.')) };
      if (name === 'dailySummary.get') {
        const items = accessible.filter((row) => row.type === 'task' || (row.type === 'publication' && !row.isRead)).map((row) => ({ sourceId: row.id, type: row.type, title: row.title }));
        const sections = Object.fromEntries(['tasks', 'tasksWithoutDate', 'publications', 'deadlines', 'processes'].map((key) => {
          const sectionItems = items.filter((item) => (key === 'tasks' && item.type === 'task') || (key === 'publications' && item.type === 'publication'));
          return [key, { key, items: sectionItems, count: sectionItems.length, state: sectionItems.length ? 'ready' : 'empty' }];
        }));
        return { available: true, state: 'ready', scope: 'mine', generatedAt: now.toISOString(), hasMore: false, items, counts: { total: items.length }, sections };
      }
      if (name === 'clients.list') return page('clients', accessible.filter((row) => row.type === 'client' && row.full_name.includes(args.query)));
      if (name === 'clients.get') return { client: accessible.find((row) => row.type === 'client' && row.id === args.id) ?? null };
      if (name === 'tasks.list') return { ...page('tasks', accessible.filter((row) => row.type === 'task' && row.title.includes(args.query))), scope: args.scope };
      if (name === 'tasks.get') return { task: accessible.find((row) => row.type === 'task' && row.id === args.id) ?? null };
      if (name === 'publications.list') return { ...page('publications', accessible.filter((row) => row.type === 'publication' && row.processId === args.processId)), resultState: 'encontrado', hasMore: false, analysisNotice: 'Synthetic simulation preview' };
      if (name === 'publications.get') return { publication: accessible.find((row) => row.type === 'publication' && row.id === args.id) ?? null };
      throw new Error('unknown_simulated_action');
    },

  });
  return { bindings, primary: adapter('primary'), foreign: adapter('foreign'), readOnly: adapter('primary', true) };
}
