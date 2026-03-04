import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextStore } from '../store/context-store.js';

describe('ContextStore', () => {
  let store: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-test-'));
    store = new ContextStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  describe('decisions', () => {
    it('adds and retrieves a decision', async () => {
      const result = await store.addDecision({
        title: 'Use JWT',
        description: 'Use JWT for auth',
        rationale: 'Stateless and scalable',
        author: 'alice',
        tags: ['auth'],
      });

      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();

      const decisions = await store.getDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.title).toBe('Use JWT');
    });
  });

  describe('dependencies', () => {
    it('adds and retrieves a dependency', async () => {
      const result = await store.addDependency({
        from: 'alice',
        to: 'bob',
        description: 'Need user lookup endpoint',
        priority: 'blocking',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('open');

      const deps = await store.getDependencies();
      expect(deps).toHaveLength(1);
    });

    it('resolves a dependency', async () => {
      const { id } = await store.addDependency({
        from: 'alice',
        to: 'bob',
        description: 'Need user lookup endpoint',
        priority: 'blocking',
      });

      const resolved = await store.resolveDependency(id, 'Agreed on GET /users/:id');
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution).toBe('Agreed on GET /users/:id');
    });
  });

  describe('interfaces', () => {
    it('adds and retrieves an interface', async () => {
      const result = await store.addInterface({
        name: 'User API',
        between: ['auth-service', 'user-service'],
        specification: 'GET /users/:id returns { id, email, role }',
        author: 'alice',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('proposed');

      const interfaces = await store.getInterfaces();
      expect(interfaces).toHaveLength(1);
    });
  });

  describe('conflicts', () => {
    it('raises and resolves a conflict', async () => {
      const d1 = await store.addDecision({
        title: 'Use REST', description: '', rationale: '', author: 'alice', tags: [],
      });
      const d2 = await store.addDecision({
        title: 'Use GraphQL', description: '', rationale: '', author: 'bob', tags: [],
      });

      const conflict = await store.raiseConflict({
        itemIds: [d1.id, d2.id],
        description: 'REST vs GraphQL',
        author: 'bob',
      });

      expect(conflict.status).toBe('open');

      const resolved = await store.resolveConflict(
        conflict.id,
        'GraphQL chosen',
        d1.id
      );
      expect(resolved.status).toBe('resolved');

      const decisions = await store.getDecisions();
      const superseded = decisions.find(d => d.id === d1.id);
      expect(superseded!.supersededBy).toBe(d2.id);
    });
  });

  describe('context', () => {
    it('returns full context', async () => {
      await store.addDecision({
        title: 'Use JWT', description: '', rationale: '', author: 'alice', tags: [],
      });

      const context = await store.getContext();
      expect(context.decisions).toHaveLength(1);
      expect(context.dependencies).toHaveLength(0);
      expect(context.interfaces).toHaveLength(0);
      expect(context.conflicts).toHaveLength(0);
    });
  });
});
