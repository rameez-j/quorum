import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRelay } from '@quorum/relay';
import { ContextStore, createToolDispatcher } from '@quorum/server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import type { ClientMessage, RelayMessage } from '@quorum/shared';
import { generateId } from '@quorum/shared';

const TEST_PORT = 9878;

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<RelayMessage> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()) as RelayMessage);
    });
  });
}

function send(ws: WebSocket, msg: ClientMessage): void {
  ws.send(JSON.stringify(msg));
}

describe('Integration: Host + Relay + Member', () => {
  let relay: ReturnType<typeof createRelay>;
  let tempDir: string;

  beforeEach(async () => {
    relay = createRelay(TEST_PORT);
    await relay.start();
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-integration-'));
  });

  afterEach(async () => {
    await relay.stop();
    await rm(tempDir, { recursive: true });
  });

  it('member can post a decision through the relay to the host', async () => {
    const store = new ContextStore(tempDir);
    const dispatch = createToolDispatcher(store);

    // Host connects and creates session
    const host = await connectClient(TEST_PORT);
    const createPromise = waitForMessage(host);
    send(host, { type: 'create_session', payload: { hostId: 'host-1', name: 'Alice' } });
    const sessionCreated = await createPromise;
    const sessionId = (sessionCreated.payload as { sessionId: string }).sessionId;

    // Host listens for tool_requests and dispatches them
    host.on('message', async (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;
      if (msg.type === 'tool_request') {
        const { requestId, tool, args } = msg.payload;
        try {
          const result = await dispatch(tool, args as Record<string, unknown>);
          send(host, { type: 'tool_response', payload: { requestId, result } });
        } catch (error) {
          send(host, {
            type: 'tool_response',
            payload: { requestId, result: null, error: (error as Error).message },
          });
        }
      }
    });

    // Member connects and joins
    const member = await connectClient(TEST_PORT);
    const joinPromise = waitForMessage(member);
    send(member, {
      type: 'join_session',
      payload: { sessionId, memberId: 'member-1', name: 'Bob' },
    });
    await joinPromise; // member_joined

    // Member sends a tool_request
    const requestId = generateId();
    const responsePromise = waitForMessage(member);
    send(member, {
      type: 'tool_request',
      payload: {
        requestId,
        tool: 'post_decision',
        args: {
          title: 'Use GraphQL',
          description: 'GraphQL for API',
          rationale: 'Flexible queries',
          author: 'bob',
          tags: ['api'],
        },
      },
    });

    const response = await responsePromise;
    expect(response.type).toBe('tool_response');
    const result = response.payload as { requestId: string; result: { id: string; timestamp: string } };
    expect(result.result.id).toBeDefined();

    // Verify the decision was persisted on the host
    const decisions = await store.getDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.title).toBe('Use GraphQL');
    expect(decisions[0]!.author).toBe('bob');

    host.close();
    member.close();
  });
});
