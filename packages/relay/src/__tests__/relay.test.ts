import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createRelay } from '../relay.js';
import type { ClientMessage, RelayMessage } from '@quorum/shared';

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

describe('Relay', () => {
  let relay: ReturnType<typeof createRelay>;
  const PORT = 9877;

  beforeEach(async () => {
    relay = createRelay(PORT);
    await relay.start();
  });

  afterEach(async () => {
    await relay.stop();
  });

  it('creates a session and returns session ID', async () => {
    const host = await connectClient(PORT);
    const responsePromise = waitForMessage(host);

    send(host, { type: 'create_session', payload: { hostId: 'host-1', name: 'Alice' } });

    const response = await responsePromise;
    expect(response.type).toBe('session_created');
    expect(response.payload).toHaveProperty('sessionId');

    host.close();
  });

  it('allows a member to join and notifies the host', async () => {
    const host = await connectClient(PORT);
    const createPromise = waitForMessage(host);
    send(host, { type: 'create_session', payload: { hostId: 'host-1', name: 'Alice' } });
    const { payload } = await createPromise;
    const sessionId = (payload as { sessionId: string }).sessionId;

    const joinNotification = waitForMessage(host);

    const member = await connectClient(PORT);
    const memberResponse = waitForMessage(member);
    send(member, {
      type: 'join_session',
      payload: { sessionId, memberId: 'member-1', name: 'Bob' },
    });

    const notification = await joinNotification;
    expect(notification.type).toBe('member_joined');

    const ack = await memberResponse;
    expect(ack.type).toBe('member_joined');

    host.close();
    member.close();
  });

  it('forwards tool_request from member to host and tool_response back', async () => {
    const host = await connectClient(PORT);
    const createPromise = waitForMessage(host);
    send(host, { type: 'create_session', payload: { hostId: 'host-1', name: 'Alice' } });
    const { payload } = await createPromise;
    const sessionId = (payload as { sessionId: string }).sessionId;

    const member = await connectClient(PORT);
    waitForMessage(host); // consume member_joined on host
    const memberAck = waitForMessage(member);
    send(member, {
      type: 'join_session',
      payload: { sessionId, memberId: 'member-1', name: 'Bob' },
    });
    await memberAck;

    const hostReceives = waitForMessage(host);
    send(member, {
      type: 'tool_request',
      payload: { requestId: 'req-1', tool: 'get_context', args: {} },
    });

    const forwarded = await hostReceives;
    expect(forwarded.type).toBe('tool_request');
    expect(forwarded.payload).toEqual({
      requestId: 'req-1',
      tool: 'get_context',
      args: {},
    });

    const memberReceives = waitForMessage(member);
    send(host, {
      type: 'tool_response',
      payload: { requestId: 'req-1', result: { decisions: [] } },
    });

    const response = await memberReceives;
    expect(response.type).toBe('tool_response');

    host.close();
    member.close();
  });
});
