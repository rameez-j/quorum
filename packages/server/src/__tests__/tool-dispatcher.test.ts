import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextStore } from '../store/context-store.js';
import { createToolDispatcher } from '../tool-dispatcher.js';

describe('ToolDispatcher', () => {
  let store: ContextStore;
  let dispatch: ReturnType<typeof createToolDispatcher>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-dispatch-test-'));
    store = new ContextStore(tempDir);
    dispatch = createToolDispatcher(store);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('dispatches post_decision and returns result', async () => {
    const result = await dispatch('post_decision', {
      title: 'Use JWT',
      description: 'JWT for auth',
      rationale: 'Stateless',
      author: 'alice',
      tags: ['auth'],
    });
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('timestamp');
  });

  it('dispatches get_context and returns data', async () => {
    await dispatch('post_decision', {
      title: 'Use JWT', description: '', rationale: '', author: 'alice', tags: [],
    });

    const result = await dispatch('get_context', {}) as { decisions: unknown[] };
    expect(result.decisions).toHaveLength(1);
  });

  it('throws on unknown tool', async () => {
    await expect(dispatch('unknown_tool', {})).rejects.toThrow('Unknown tool');
  });
});
