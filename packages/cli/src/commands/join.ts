import WebSocket from 'ws';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpProxy } from '../proxy/mcp-proxy.js';
import { RELAY_URL } from '../config.js';
import type { ClientMessage, RelayMessage } from '@quorum/shared';
import { generateId } from '@quorum/shared';

export async function joinCommand(sessionId: string, options: { name: string }) {
  const memberId = generateId();

  console.log(`Joining session ${sessionId}...`);

  const ws = new WebSocket(RELAY_URL);

  // Pending tool requests waiting for responses
  const pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();

  // Tool handler that forwards requests through relay to host
  const toolHandler = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const requestId = generateId();
    const msg: ClientMessage = {
      type: 'tool_request',
      payload: { requestId, tool: name, args },
    };

    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject });
      ws.send(JSON.stringify(msg));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('Tool request timed out'));
        }
      }, 30000);
    });
  };

  const { server: proxyServer, setTools } = createMcpProxy(toolHandler);

  // Set up the default tools (these match the host's tool names)
  setTools([
    { name: 'get_context', description: 'Get shared project context', inputSchema: { type: 'object', properties: {} } },
    { name: 'post_decision', description: 'Record an architecture decision', inputSchema: { type: 'object', properties: {} } },
    { name: 'flag_dependency', description: 'Declare a dependency', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_dependencies', description: 'View dependencies', inputSchema: { type: 'object', properties: {} } },
    { name: 'sync', description: 'Get full session snapshot', inputSchema: { type: 'object', properties: {} } },
    { name: 'post_interface', description: 'Define an API contract', inputSchema: { type: 'object', properties: {} } },
    { name: 'resolve_dependency', description: 'Resolve a dependency', inputSchema: { type: 'object', properties: {} } },
    { name: 'raise_conflict', description: 'Flag a conflict', inputSchema: { type: 'object', properties: {} } },
    { name: 'resolve_conflict', description: 'Resolve a conflict', inputSchema: { type: 'object', properties: {} } },
  ]);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      const msg: ClientMessage = {
        type: 'join_session',
        payload: { sessionId, memberId, name: options.name },
      };
      ws.send(JSON.stringify(msg));
    });
    ws.on('error', reject);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;

      switch (msg.type) {
        case 'member_joined':
          if (msg.payload.memberId === memberId) {
            console.log(`✓ Connected to session ${sessionId}`);
            console.log('✓ MCP tools available');
            resolve();
          } else {
            console.log(`  → ${msg.payload.name} joined`);
          }
          break;

        case 'member_left':
          console.log(`  ← ${msg.payload.name} left`);
          break;

        case 'tool_response': {
          const pending = pendingRequests.get(msg.payload.requestId);
          if (pending) {
            pendingRequests.delete(msg.payload.requestId);
            if ('error' in msg.payload && msg.payload.error) {
              pending.reject(new Error(msg.payload.error as string));
            } else {
              pending.resolve(msg.payload.result);
            }
          }
          break;
        }

        case 'error':
          console.error(`Error: ${msg.payload.message}`);
          break;
      }
    });
  });

  // Start the proxy MCP server on stdio for Claude Code
  const transport = new StdioServerTransport();
  await proxyServer.connect(transport);

  process.on('SIGINT', async () => {
    console.log('\nLeaving session...');
    const msg: ClientMessage = {
      type: 'leave_session',
      payload: { memberId },
    };
    ws.send(JSON.stringify(msg));
    ws.close();
    await proxyServer.close();
    process.exit(0);
  });
}
