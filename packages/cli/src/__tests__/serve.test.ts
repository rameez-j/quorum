import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServeServer } from '../commands/serve.js';

describe('serve: session management tools', () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const { server } = createServeServer();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  it('quorum_status returns idle when no session is active', async () => {
    const result = await client.callTool({ name: 'quorum_status', arguments: {} });
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    const data = JSON.parse(text);
    expect(data.status).toBe('idle');
  });

  it('quorum_stop returns error when idle', async () => {
    const result = await client.callTool({ name: 'quorum_stop', arguments: {} });
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain('No active session');
  });

  it('context tools return error when idle', async () => {
    const result = await client.callTool({ name: 'get_context', arguments: {} });
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    expect(text).toContain('No active session');
  });

  it('lists all 13 tools', async () => {
    const result = await client.listTools();
    const names = result.tools.map(t => t.name).sort();
    expect(names).toEqual([
      'flag_dependency',
      'get_context',
      'get_dependencies',
      'post_decision',
      'post_interface',
      'quorum_join',
      'quorum_start',
      'quorum_status',
      'quorum_stop',
      'raise_conflict',
      'resolve_conflict',
      'resolve_dependency',
      'sync',
    ]);
  });
});
