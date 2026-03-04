import WebSocket from 'ws';
import { createQuorumServer, createToolDispatcher } from '@quorum/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RELAY_URL } from '../config.js';
import type { ClientMessage, RelayMessage, Member } from '@quorum/shared';
import { generateId } from '@quorum/shared';
import { join } from 'node:path';

export async function startCommand(options: { name: string }) {
  const storeDir = join(process.cwd(), '.collab');
  const { server, store, setMembers } = createQuorumServer(storeDir);
  const dispatch = createToolDispatcher(store);
  const members: Member[] = [];
  const hostId = generateId();

  console.log('Starting Quorum session...');

  // Connect to relay
  const ws = new WebSocket(RELAY_URL);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      const msg: ClientMessage = {
        type: 'create_session',
        payload: { hostId, name: options.name },
      };
      ws.send(JSON.stringify(msg));
    });
    ws.on('error', reject);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;

      switch (msg.type) {
        case 'session_created':
          console.log(`✓ Session created: ${msg.payload.sessionId}`);
          console.log(`\nShare with your team: quorum join ${msg.payload.sessionId}\n`);
          console.log('Waiting for members...');
          resolve();
          break;

        case 'member_joined':
          console.log(`  → ${msg.payload.name} joined`);
          members.push({
            id: msg.payload.memberId,
            name: msg.payload.name,
            connectedAt: new Date().toISOString(),
          });
          setMembers(members);
          break;

        case 'member_left':
          console.log(`  ← ${msg.payload.name} left`);
          const idx = members.findIndex(m => m.id === msg.payload.memberId);
          if (idx !== -1) members.splice(idx, 1);
          setMembers(members);
          break;

        case 'tool_request': {
          const { requestId, tool, args } = msg.payload;
          dispatch(tool, args as Record<string, unknown>).then((result) => {
            const response: ClientMessage = {
              type: 'tool_response',
              payload: { requestId, result },
            };
            ws.send(JSON.stringify(response));
          }).catch((error) => {
            const response: ClientMessage = {
              type: 'tool_response',
              payload: {
                requestId,
                result: null,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            };
            ws.send(JSON.stringify(response));
          });
          break;
        }
      }
    });
  });

  // Also start local MCP server for the host's own Claude Code
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nStopping session...');
    ws.close();
    await server.close();
    process.exit(0);
  });
}
