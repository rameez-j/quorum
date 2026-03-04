import { ContextStore } from './store/context-store.js';

export function createToolDispatcher(store: ContextStore) {
  return async function dispatch(
    tool: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    switch (tool) {
      case 'get_context': {
        const filter = args.filter as string | undefined;
        const context = await store.getContext();
        if (filter && filter !== 'all') {
          return { [filter]: (context as unknown as Record<string, unknown>)[filter], members: context.members };
        }
        return context;
      }

      case 'post_decision':
        return store.addDecision({
          title: args.title as string,
          description: args.description as string,
          rationale: args.rationale as string,
          author: args.author as string,
          tags: (args.tags as string[]) ?? [],
        });

      case 'flag_dependency':
        return store.addDependency({
          from: args.from as string,
          to: args.to as string,
          description: args.description as string,
          priority: args.priority as 'blocking' | 'nice-to-have',
        });

      case 'get_dependencies':
        return {
          dependencies: await store.getDependencies({
            member: args.member as string | undefined,
            status: args.status as 'open' | 'resolved' | undefined,
          }),
        };

      case 'sync': {
        const context = await store.getContext();
        return {
          members: context.members,
          recentDecisions: context.decisions.slice(-10),
          openDependencies: context.dependencies.filter(d => d.status === 'open'),
          unresolvedInterfaces: context.interfaces.filter(i => i.status === 'proposed'),
          openConflicts: context.conflicts.filter(c => c.status === 'open'),
        };
      }

      case 'post_interface':
        return store.addInterface({
          name: args.name as string,
          between: args.between as [string, string],
          specification: args.specification as string,
          author: args.author as string,
        });

      case 'resolve_dependency':
        return store.resolveDependency(
          args.dependencyId as string,
          args.resolution as string
        );

      case 'raise_conflict':
        return store.raiseConflict({
          itemIds: args.itemIds as [string, string],
          description: args.description as string,
          author: args.author as string,
        });

      case 'resolve_conflict':
        return store.resolveConflict(
          args.conflictId as string,
          args.resolution as string,
          args.supersedes as string | undefined
        );

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  };
}
