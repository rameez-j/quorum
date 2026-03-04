import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpProxy } from '../proxy/mcp-proxy.js';

describe('MCP Proxy', () => {
  it('lists the same tools the host provides', async () => {
    const hostTools = [
      { name: 'get_context', description: 'Get context', inputSchema: { type: 'object' as const, properties: {} } },
      { name: 'post_decision', description: 'Post decision', inputSchema: { type: 'object' as const, properties: {} } },
    ];

    const toolHandler = async (name: string, args: Record<string, unknown>) => {
      return { decisions: [] };
    };

    const { server, setTools } = createMcpProxy(toolHandler);
    setTools(hostTools);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(['get_context', 'post_decision']);

    await client.close();
    await server.close();
  });

  it('forwards tool calls through the handler', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

    const toolHandler = async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { decisions: [{ id: '1', title: 'Test' }] };
    };

    const { server, setTools } = createMcpProxy(toolHandler);
    setTools([
      { name: 'get_context', description: 'Get context', inputSchema: { type: 'object' as const, properties: {} } },
    ]);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'get_context', arguments: {} });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.name).toBe('get_context');

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0]!.text
    );
    expect(data.decisions).toHaveLength(1);

    await client.close();
    await server.close();
  });
});
