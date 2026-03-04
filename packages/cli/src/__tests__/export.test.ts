import { describe, it, expect } from 'vitest';
import { generateContextMarkdown } from '../export.js';
import type { Decision, Dependency, Interface, Conflict, Member } from '@quorum/shared';

describe('generateContextMarkdown', () => {
  it('generates markdown with all sections', () => {
    const data = {
      brief: 'Build a task management API',
      decisions: [
        {
          id: '1', title: 'Use PostgreSQL', description: 'Primary database',
          rationale: 'Strong typing, JSONB', author: 'alice',
          timestamp: '2026-03-04T12:00:00Z', tags: ['database'],
        },
      ] as Decision[],
      dependencies: [
        {
          id: '2', from: 'alice', to: 'bob',
          description: 'Need user endpoint', priority: 'blocking' as const,
          status: 'resolved' as const, resolution: 'GET /users/:id',
          timestamp: '2026-03-04T12:05:00Z',
        },
      ] as Dependency[],
      interfaces: [
        {
          id: '3', name: 'User API', between: ['auth', 'users'] as [string, string],
          specification: 'GET /users/:id → { id, email }',
          author: 'bob', status: 'agreed' as const,
          timestamp: '2026-03-04T12:10:00Z',
        },
      ] as Interface[],
      conflicts: [] as Conflict[],
    };

    const members: Member[] = [
      { id: 'a', name: 'Alice', connectedAt: '2026-03-04T12:00:00Z' },
      { id: 'b', name: 'Bob', connectedAt: '2026-03-04T12:01:00Z' },
    ];

    const md = generateContextMarkdown(data, members);

    expect(md).toContain('# Project Context');
    expect(md).toContain('## Brief');
    expect(md).toContain('Build a task management API');
    expect(md).toContain('## Team');
    expect(md).toContain('Alice');
    expect(md).toContain('## Decisions');
    expect(md).toContain('Use PostgreSQL');
    expect(md).toContain('## Interfaces');
    expect(md).toContain('User API');
    expect(md).toContain('## Dependencies');
    expect(md).toContain('Need user endpoint');
  });

  it('marks superseded decisions with strikethrough', () => {
    const data = {
      brief: '',
      decisions: [
        {
          id: '1', title: 'Use REST', description: '', rationale: '',
          author: 'alice', timestamp: '', tags: [], supersededBy: '2',
        },
        {
          id: '2', title: 'Use GraphQL', description: '', rationale: '',
          author: 'bob', timestamp: '', tags: [],
        },
      ] as Decision[],
      dependencies: [],
      interfaces: [],
      conflicts: [],
    };

    const md = generateContextMarkdown(data, []);
    expect(md).toContain('~~Use REST~~');
  });
});
