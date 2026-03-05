import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRelay } from '@quorum/relay';

const TEST_RELAY_PORT = 9879;
const COLLAB_DIR = join(process.cwd(), '.collab');

vi.mock('../config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config.js')>();
  return {
    ...actual,
    RELAY_URL: `ws://localhost:${TEST_RELAY_PORT}`,
  };
});

const { createServeServer } = await import('../commands/serve.js');

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

describe('serve: host context tools via relay', () => {
  let relay: ReturnType<typeof createRelay>;
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    await rm(COLLAB_DIR, { recursive: true, force: true });

    relay = createRelay(TEST_RELAY_PORT);
    await relay.start();

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
      await relay.stop();
      await rm(COLLAB_DIR, { recursive: true, force: true });
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  it('host can start session and post a decision', async () => {
    // Start session
    const startResult = await client.callTool({ name: 'quorum_start', arguments: { name: 'Alice' } });
    const startText = (startResult.content as Array<{ text: string }>)[0]!.text;
    const startData = JSON.parse(startText);
    expect(startData.status).toBe('hosting');
    expect(startData.sessionId).toBeDefined();

    // Post a decision
    const decisionResult = await client.callTool({
      name: 'post_decision',
      arguments: {
        title: 'Use REST',
        description: 'REST API for backend',
        rationale: 'Simpler than GraphQL',
        author: 'Alice',
        tags: ['api'],
      },
    });
    const decisionText = (decisionResult.content as Array<{ text: string }>)[0]!.text;
    const decisionData = JSON.parse(decisionText);
    expect(decisionData.id).toBeDefined();

    // Verify via get_context
    const ctxResult = await client.callTool({ name: 'get_context', arguments: {} });
    const ctxText = (ctxResult.content as Array<{ text: string }>)[0]!.text;
    const ctxData = JSON.parse(ctxText);
    expect(ctxData.decisions).toHaveLength(1);
    expect(ctxData.decisions[0].title).toBe('Use REST');

    // Stop session
    const stopResult = await client.callTool({ name: 'quorum_stop', arguments: {} });
    const stopText = (stopResult.content as Array<{ text: string }>)[0]!.text;
    expect(stopText).toContain('Session ended');

    // Verify back to idle
    const statusResult = await client.callTool({ name: 'quorum_status', arguments: {} });
    const statusText = (statusResult.content as Array<{ text: string }>)[0]!.text;
    const statusData = JSON.parse(statusText);
    expect(statusData.status).toBe('idle');
  });
});

describe('serve: member tool forwarding via relay', () => {
  let relay: ReturnType<typeof createRelay>;
  let hostClient: Client;
  let memberClient: Client;
  let hostServer: ReturnType<typeof createServeServer>['server'];
  let memberServer: ReturnType<typeof createServeServer>['server'];

  beforeEach(async () => {
    await rm(COLLAB_DIR, { recursive: true, force: true });

    relay = createRelay(TEST_RELAY_PORT);
    await relay.start();

    // Set up host: createServeServer + MCP client via InMemoryTransport
    const host = createServeServer();
    hostServer = host.server;
    hostClient = new Client({ name: 'host-client', version: '1.0.0' });
    const [hostClientTransport, hostServerTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      hostClient.connect(hostClientTransport),
      hostServer.connect(hostServerTransport),
    ]);

    // Set up member: separate createServeServer + MCP client via InMemoryTransport
    const member = createServeServer();
    memberServer = member.server;
    memberClient = new Client({ name: 'member-client', version: '1.0.0' });
    const [memberClientTransport, memberServerTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      memberClient.connect(memberClientTransport),
      memberServer.connect(memberServerTransport),
    ]);
  });

  afterEach(async () => {
    await memberClient.close();
    await memberServer.close();
    await hostClient.close();
    await hostServer.close();
    await relay.stop();
    await rm(COLLAB_DIR, { recursive: true, force: true });
  });

  it('member can post a decision that is stored on the host', async () => {
    // 1. Host starts a session
    const startResult = await hostClient.callTool({ name: 'quorum_start', arguments: { name: 'Alice' } });
    const startText = (startResult.content as Array<{ text: string }>)[0]!.text;
    const startData = JSON.parse(startText);
    expect(startData.status).toBe('hosting');
    const sessionId = startData.sessionId;

    // 2. Member joins the session
    const joinResult = await memberClient.callTool({
      name: 'quorum_join',
      arguments: { sessionId, name: 'Bob' },
    });
    const joinText = (joinResult.content as Array<{ text: string }>)[0]!.text;
    const joinData = JSON.parse(joinText);
    expect(joinData.status).toBe('joined');
    expect(joinData.sessionId).toBe(sessionId);

    // 3. Member posts a decision (forwarded through relay to host)
    const decisionResult = await memberClient.callTool({
      name: 'post_decision',
      arguments: {
        title: 'Use PostgreSQL',
        description: 'PostgreSQL for the database layer',
        rationale: 'Strong relational model and JSON support',
        author: 'Bob',
        tags: ['database'],
      },
    });
    const decisionText = (decisionResult.content as Array<{ text: string }>)[0]!.text;
    const decisionData = JSON.parse(decisionText);
    expect(decisionData.id).toBeDefined();

    // 4. Host verifies the decision is stored in its context
    const ctxResult = await hostClient.callTool({ name: 'get_context', arguments: {} });
    const ctxText = (ctxResult.content as Array<{ text: string }>)[0]!.text;
    const ctxData = JSON.parse(ctxText);
    expect(ctxData.decisions).toHaveLength(1);
    expect(ctxData.decisions[0].title).toBe('Use PostgreSQL');
    expect(ctxData.decisions[0].author).toBe('Bob');

    // 5. Stop both sessions
    await memberClient.callTool({ name: 'quorum_stop', arguments: {} });
    await hostClient.callTool({ name: 'quorum_stop', arguments: {} });
  });
});
