import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQuorumServer } from '../mcp/server.js';

describe('Quorum MCP Server', () => {
  let client: Client;
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-mcp-test-'));
    const { server } = createQuorumServer(tempDir);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterEach(async () => {
    await cleanup();
    await rm(tempDir, { recursive: true });
  });

  it('lists all 9 tools', async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map(t => t.name).sort();
    expect(toolNames).toEqual([
      'flag_dependency',
      'get_context',
      'get_dependencies',
      'post_decision',
      'post_interface',
      'raise_conflict',
      'resolve_conflict',
      'resolve_dependency',
      'sync',
    ]);
  });

  it('posts and retrieves a decision via tools', async () => {
    const postResult = await client.callTool({
      name: 'post_decision',
      arguments: {
        title: 'Use JWT',
        description: 'JWT for authentication',
        rationale: 'Stateless',
        author: 'alice',
        tags: ['auth'],
      },
    });

    expect(postResult.content).toBeDefined();
    const postData = JSON.parse(
      (postResult.content as Array<{ type: string; text: string }>)[0]!.text
    );
    expect(postData.id).toBeDefined();

    const getResult = await client.callTool({
      name: 'get_context',
      arguments: {},
    });
    const contextData = JSON.parse(
      (getResult.content as Array<{ type: string; text: string }>)[0]!.text
    );
    expect(contextData.decisions).toHaveLength(1);
    expect(contextData.decisions[0].title).toBe('Use JWT');
  });
});
