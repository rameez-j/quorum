import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ContextStore } from '../store/context-store.js';
import type { Member } from '@quorum/shared';

export function createQuorumServer(storeDir: string) {
  const store = new ContextStore(storeDir);
  let members: Member[] = [];

  const server = new McpServer({
    name: 'quorum',
    version: '0.1.0',
  });

  function jsonResponse(data: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
  }

  // 1. get_context
  server.tool(
    'get_context',
    'Get shared project context including decisions, interfaces, and dependencies',
    {
      filter: z.enum(['decisions', 'interfaces', 'dependencies', 'all']).optional(),
    },
    async ({ filter }) => {
      const context = await store.getContext();
      context.members = members;

      if (filter && filter !== 'all') {
        return jsonResponse({
          [filter]: context[filter],
          members: context.members,
        });
      }
      return jsonResponse(context);
    }
  );

  // 2. post_decision
  server.tool(
    'post_decision',
    'Record an architecture or design decision for the team',
    {
      title: z.string(),
      description: z.string(),
      rationale: z.string(),
      author: z.string(),
      tags: z.array(z.string()).optional(),
    },
    async ({ title, description, rationale, author, tags }) => {
      const decision = await store.addDecision({
        title, description, rationale, author, tags: tags ?? [],
      });
      return jsonResponse({ id: decision.id, timestamp: decision.timestamp });
    }
  );

  // 3. flag_dependency
  server.tool(
    'flag_dependency',
    'Declare a dependency on another team member\'s work',
    {
      from: z.string(),
      to: z.string(),
      description: z.string(),
      priority: z.enum(['blocking', 'nice-to-have']),
    },
    async ({ from, to, description, priority }) => {
      const dep = await store.addDependency({ from, to, description, priority });
      return jsonResponse({ id: dep.id, status: dep.status });
    }
  );

  // 4. get_dependencies
  server.tool(
    'get_dependencies',
    'View all declared dependencies and their resolution status',
    {
      member: z.string().optional(),
      status: z.enum(['open', 'resolved']).optional(),
    },
    async ({ member, status }) => {
      const deps = await store.getDependencies({ member, status });
      return jsonResponse({ dependencies: deps });
    }
  );

  // 5. sync
  server.tool(
    'sync',
    'Get a full snapshot of the current session state and all members',
    {},
    async () => {
      const context = await store.getContext();
      return jsonResponse({
        members,
        recentDecisions: context.decisions.slice(-10),
        openDependencies: context.dependencies.filter(d => d.status === 'open'),
        unresolvedInterfaces: context.interfaces.filter(i => i.status === 'proposed'),
        openConflicts: context.conflicts.filter(c => c.status === 'open'),
      });
    }
  );

  // 6. post_interface
  server.tool(
    'post_interface',
    'Define an API contract or interface between two components',
    {
      name: z.string(),
      between: z.tuple([z.string(), z.string()]),
      specification: z.string(),
      author: z.string(),
    },
    async ({ name, between, specification, author }) => {
      const iface = await store.addInterface({ name, between, specification, author });
      return jsonResponse({ id: iface.id, status: iface.status });
    }
  );

  // 7. resolve_dependency
  server.tool(
    'resolve_dependency',
    'Mark a flagged dependency as resolved with a resolution description',
    {
      dependencyId: z.string(),
      resolution: z.string(),
    },
    async ({ dependencyId, resolution }) => {
      const dep = await store.resolveDependency(dependencyId, resolution);
      return jsonResponse({ id: dep.id, status: dep.status });
    }
  );

  // 8. raise_conflict
  server.tool(
    'raise_conflict',
    'Flag that two decisions or interfaces are in conflict and need resolution',
    {
      itemIds: z.tuple([z.string(), z.string()]),
      description: z.string(),
      author: z.string(),
    },
    async ({ itemIds, description, author }) => {
      const conflict = await store.raiseConflict({ itemIds, description, author });
      return jsonResponse({ id: conflict.id, status: conflict.status });
    }
  );

  // 9. resolve_conflict
  server.tool(
    'resolve_conflict',
    'Resolve a conflict, optionally superseding one of the conflicting decisions',
    {
      conflictId: z.string(),
      resolution: z.string(),
      supersedes: z.string().optional(),
    },
    async ({ conflictId, resolution, supersedes }) => {
      const conflict = await store.resolveConflict(conflictId, resolution, supersedes);
      return jsonResponse({ id: conflict.id, status: conflict.status });
    }
  );

  return {
    server,
    store,
    setMembers(m: Member[]) {
      members = m;
    },
  };
}
