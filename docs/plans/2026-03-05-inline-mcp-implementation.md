# Inline MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the multi-terminal CLI workflow with a single MCP server process (`quorum serve`) that Claude Code spawns and manages, plus `install`/`uninstall` commands for registration.

**Architecture:** A new `serve` command starts an MCP server on stdio with 13 tools (4 session management + 9 context). The server maintains a state machine (IDLE/HOSTING/JOINED). Session tools (`quorum_start`, `quorum_join`) connect to the relay and activate context tools. The existing `ContextStore`, `createToolDispatcher`, relay, and shared packages are reused as-is.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `ws` (WebSocket), `zod`, `commander`, vitest

---

### Task 1: Update config.ts for install/uninstall

**Files:**
- Modify: `packages/cli/src/config.ts`
- Test: `packages/cli/src/__tests__/config.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/cli/src/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { registerMcpServer, unregisterMcpServer } from '../config.js';

describe('config', () => {
  let tempDir: string;
  let settingsPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-config-'));
    settingsPath = join(tempDir, 'settings.json');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('registers quorum MCP server in settings file', async () => {
    await registerMcpServer(settingsPath);
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    expect(settings.mcpServers.quorum).toEqual({
      command: 'npx',
      args: ['-y', 'quorum', 'serve'],
    });
  });

  it('preserves existing settings when registering', async () => {
    await mkdir(tempDir, { recursive: true });
    const existing = { someKey: 'someValue', mcpServers: { other: { command: 'foo' } } };
    const { writeFile: wf } = await import('node:fs/promises');
    await wf(settingsPath, JSON.stringify(existing));

    await registerMcpServer(settingsPath);
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    expect(settings.someKey).toBe('someValue');
    expect(settings.mcpServers.other).toEqual({ command: 'foo' });
    expect(settings.mcpServers.quorum).toBeDefined();
  });

  it('unregisters quorum MCP server from settings file', async () => {
    await registerMcpServer(settingsPath);
    await unregisterMcpServer(settingsPath);
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    expect(settings.mcpServers.quorum).toBeUndefined();
  });

  it('unregister is a no-op when file does not exist', async () => {
    // Should not throw
    await unregisterMcpServer(join(tempDir, 'nonexistent.json'));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && npx vitest run src/__tests__/config.test.ts`
Expected: FAIL — `registerMcpServer` signature expects `proxyPort: number`, not `settingsPath: string`

**Step 3: Update config.ts**

Replace `packages/cli/src/config.ts` with:

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const MCP_SERVER_NAME = 'quorum';

interface ClaudeSettings {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
  [key: string]: unknown;
}

function globalSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}

function projectSettingsPath(): string {
  return join(process.cwd(), '.claude', 'settings.json');
}

export function getSettingsPath(project: boolean): string {
  return project ? projectSettingsPath() : globalSettingsPath();
}

export async function registerMcpServer(settingsPath: string): Promise<void> {
  let settings: ClaudeSettings = {};
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    settings = JSON.parse(raw) as ClaudeSettings;
  } catch {
    // File doesn't exist yet
  }

  settings.mcpServers ??= {};
  settings.mcpServers[MCP_SERVER_NAME] = {
    command: 'npx',
    args: ['-y', 'quorum', 'serve'],
  };

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

export async function unregisterMcpServer(settingsPath: string): Promise<void> {
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as ClaudeSettings;
    if (settings.mcpServers) {
      delete settings.mcpServers[MCP_SERVER_NAME];
    }
    await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  } catch {
    // File doesn't exist, nothing to clean up
  }
}

export const RELAY_URL = process.env['QUORUM_RELAY_URL'] ?? 'ws://localhost:7777';
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && npx vitest run src/__tests__/config.test.ts`
Expected: PASS — all 4 tests

**Step 5: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/__tests__/config.test.ts
git commit -m "feat: update config for install/uninstall with path-based API"
```

---

### Task 2: Add install/uninstall CLI commands

**Files:**
- Modify: `packages/cli/src/index.ts`

**Step 1: Update index.ts to add install, uninstall, and serve commands**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { exportCommand } from './commands/export-context.js';
import { registerMcpServer, unregisterMcpServer, getSettingsPath } from './config.js';

const program = new Command();

program
  .name('quorum')
  .description('Keep your team\'s AI agents in sync')
  .version('0.1.0');

program
  .command('install')
  .description('Register Quorum as an MCP server in Claude Code')
  .option('--project', 'Register in project-level settings instead of global')
  .action(async (options: { project?: boolean }) => {
    const path = getSettingsPath(!!options.project);
    await registerMcpServer(path);
    const scope = options.project ? 'project' : 'global';
    console.log(`✓ Quorum registered in ${scope} Claude Code settings`);
    console.log('  Restart Claude Code to activate.');
  });

program
  .command('uninstall')
  .description('Remove Quorum from Claude Code settings')
  .option('--project', 'Remove from project-level settings instead of global')
  .action(async (options: { project?: boolean }) => {
    const path = getSettingsPath(!!options.project);
    await unregisterMcpServer(path);
    const scope = options.project ? 'project' : 'global';
    console.log(`✓ Quorum removed from ${scope} Claude Code settings`);
  });

program
  .command('serve')
  .description('Start the Quorum MCP server (used by Claude Code, not run directly)')
  .action(async () => {
    const { serveCommand } = await import('./commands/serve.js');
    await serveCommand();
  });

program
  .command('export')
  .description('Export session context to .collab/context.md')
  .action(exportCommand);

program.parse();
```

**Step 2: Verify it compiles**

Run: `cd packages/cli && npx tsc --noEmit`
Expected: Error about missing `./commands/serve.js` — that's expected, we'll create it in Task 3.

**Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat: add install, uninstall, and serve CLI commands"
```

---

### Task 3: Create the serve command — session state machine

This is the core task. The `serve` command creates an MCP server with all 13 tools, manages a state machine (IDLE/HOSTING/JOINED), and handles WebSocket connections.

**Files:**
- Create: `packages/cli/src/commands/serve.ts`
- Test: `packages/cli/src/__tests__/serve.test.ts`

**Step 1: Write the failing tests for session state machine**

```typescript
// packages/cli/src/__tests__/serve.test.ts
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
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && npx vitest run src/__tests__/serve.test.ts`
Expected: FAIL — `createServeServer` does not exist

**Step 3: Implement the serve command**

Create `packages/cli/src/commands/serve.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import WebSocket from 'ws';
import { ContextStore, createToolDispatcher } from '@quorum/server';
import type { ClientMessage, RelayMessage, Member } from '@quorum/shared';
import { generateId } from '@quorum/shared';
import { join } from 'node:path';
import { RELAY_URL } from '../config.js';

type SessionState =
  | { mode: 'idle' }
  | { mode: 'hosting'; sessionId: string; ws: WebSocket; store: ContextStore; dispatch: ReturnType<typeof createToolDispatcher>; members: Member[] }
  | { mode: 'joined'; sessionId: string; ws: WebSocket; memberId: string; pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> };

export function createServeServer() {
  let state: SessionState = { mode: 'idle' };

  const server = new McpServer({
    name: 'quorum',
    version: '0.1.0',
  });

  function jsonResponse(data: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
  }

  function textResponse(message: string) {
    return { content: [{ type: 'text' as const, text: message }] };
  }

  function idleError() {
    return textResponse('No active session. Use quorum_start or quorum_join first.');
  }

  function alreadyActiveError() {
    const sessionId = state.mode === 'hosting' ? state.sessionId : state.mode === 'joined' ? state.sessionId : '';
    return textResponse(`Already in session ${sessionId}. Use quorum_stop first.`);
  }

  // Connect to relay and return the WebSocket
  function connectToRelay(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(RELAY_URL);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Unable to connect. Please try again later.'));
      }, 10000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(ws);
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('Unable to connect. Please try again later.'));
      });
    });
  }

  // Wait for a specific message type from relay
  function waitForMessage(ws: WebSocket, type: string): Promise<RelayMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Unable to connect. Please try again later.')), 10000);
      const handler = (data: WebSocket.RawData) => {
        const msg = JSON.parse(data.toString()) as RelayMessage;
        if (msg.type === type) {
          clearTimeout(timeout);
          ws.off('message', handler);
          resolve(msg);
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          ws.off('message', handler);
          reject(new Error((msg.payload as { message: string }).message));
        }
      };
      ws.on('message', handler);
    });
  }

  // Reset state to idle, closing any WebSocket
  function resetToIdle() {
    if (state.mode === 'hosting' || state.mode === 'joined') {
      try { state.ws.close(); } catch {}
    }
    state = { mode: 'idle' };
  }

  // Set up the host's WebSocket message handler for tool_request forwarding
  function setupHostMessageHandler(ws: WebSocket, dispatch: ReturnType<typeof createToolDispatcher>, members: Member[]) {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;
      switch (msg.type) {
        case 'member_joined':
          members.push({
            id: msg.payload.memberId,
            name: msg.payload.name,
            connectedAt: new Date().toISOString(),
          });
          break;
        case 'member_left': {
          const idx = members.findIndex(m => m.id === msg.payload.memberId);
          if (idx !== -1) members.splice(idx, 1);
          break;
        }
        case 'tool_request': {
          const { requestId, tool, args } = msg.payload;
          dispatch(tool, args as Record<string, unknown>).then((result) => {
            const response: ClientMessage = { type: 'tool_response', payload: { requestId, result } };
            ws.send(JSON.stringify(response));
          }).catch((error) => {
            const response: ClientMessage = {
              type: 'tool_response',
              payload: { requestId, result: null, error: error instanceof Error ? error.message : 'Unknown error' },
            };
            ws.send(JSON.stringify(response));
          });
          break;
        }
      }
    });
    ws.on('close', () => {
      // If the WebSocket closes unexpectedly while hosting, reset to idle
      if (state.mode === 'hosting') {
        state = { mode: 'idle' };
      }
    });
  }

  // Set up the member's WebSocket message handler
  function setupMemberMessageHandler(ws: WebSocket, pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>) {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;
      switch (msg.type) {
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
        case 'member_joined':
        case 'member_left':
          // Could track members here if needed
          break;
        case 'error':
          break;
      }
    });
    ws.on('close', () => {
      // Host disconnected or relay went down — return to idle
      if (state.mode === 'joined') {
        // Reject all pending requests
        for (const [, pending] of pendingRequests) {
          pending.reject(new Error('Host disconnected. Session ended.'));
        }
        pendingRequests.clear();
        state = { mode: 'idle' };
      }
    });
  }

  // Forward a tool call through relay to the host (member mode)
  async function forwardToHost(tool: string, args: Record<string, unknown>): Promise<unknown> {
    if (state.mode !== 'joined') throw new Error('Not in a session');
    const { ws, pendingRequests } = state;
    const requestId = generateId();
    const msg: ClientMessage = {
      type: 'tool_request',
      payload: { requestId, tool, args },
    };

    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject });
      ws.send(JSON.stringify(msg));
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('Tool request timed out'));
        }
      }, 30000);
    });
  }

  // Execute a context tool — locally if hosting, via relay if joined
  async function executeContextTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
    if (state.mode === 'hosting') {
      return state.dispatch(tool, args);
    } else if (state.mode === 'joined') {
      return forwardToHost(tool, args);
    }
    throw new Error('No active session');
  }

  // --- SESSION MANAGEMENT TOOLS ---

  server.tool(
    'quorum_start',
    'Start a new Quorum session (you become the host)',
    { name: z.string().describe('Your display name') },
    async ({ name }) => {
      if (state.mode !== 'idle') return alreadyActiveError();
      try {
        const ws = await connectToRelay();
        const hostId = generateId();
        const createMsg: ClientMessage = { type: 'create_session', payload: { hostId, name } };
        ws.send(JSON.stringify(createMsg));
        const response = await waitForMessage(ws, 'session_created');
        const sessionId = (response.payload as { sessionId: string }).sessionId;

        const storeDir = join(process.cwd(), '.collab');
        const store = new ContextStore(storeDir);
        const dispatch = createToolDispatcher(store);
        const members: Member[] = [];

        state = { mode: 'hosting', sessionId, ws, store, dispatch, members };
        setupHostMessageHandler(ws, dispatch, members);

        return jsonResponse({
          status: 'hosting',
          sessionId,
          message: `Session created. Share this ID with your team: ${sessionId}`,
        });
      } catch (error) {
        return textResponse(error instanceof Error ? error.message : 'Unable to connect. Please try again later.');
      }
    }
  );

  server.tool(
    'quorum_join',
    'Join an existing Quorum session',
    {
      sessionId: z.string().describe('The session ID to join'),
      name: z.string().describe('Your display name'),
    },
    async ({ sessionId, name }) => {
      if (state.mode !== 'idle') return alreadyActiveError();
      try {
        const ws = await connectToRelay();
        const memberId = generateId();
        const pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

        const joinMsg: ClientMessage = { type: 'join_session', payload: { sessionId, memberId, name } };
        ws.send(JSON.stringify(joinMsg));
        await waitForMessage(ws, 'member_joined');

        state = { mode: 'joined', sessionId, ws, memberId, pendingRequests };
        setupMemberMessageHandler(ws, pendingRequests);

        return jsonResponse({
          status: 'joined',
          sessionId,
          message: `Connected to session ${sessionId}. Quorum tools are now active.`,
        });
      } catch (error) {
        return textResponse(error instanceof Error ? error.message : 'Unable to connect. Please try again later.');
      }
    }
  );

  server.tool(
    'quorum_status',
    'Check Quorum session status',
    {},
    async () => {
      if (state.mode === 'idle') {
        return jsonResponse({ status: 'idle', message: 'No active session.' });
      }
      if (state.mode === 'hosting') {
        return jsonResponse({
          status: 'hosting',
          sessionId: state.sessionId,
          members: state.members,
        });
      }
      // joined
      return jsonResponse({
        status: 'joined',
        sessionId: state.sessionId,
      });
    }
  );

  server.tool(
    'quorum_stop',
    'Stop or leave the current Quorum session',
    {},
    async () => {
      if (state.mode === 'idle') {
        return textResponse('No active session.');
      }
      if (state.mode === 'joined') {
        const leaveMsg: ClientMessage = { type: 'leave_session', payload: { memberId: state.memberId } };
        try { state.ws.send(JSON.stringify(leaveMsg)); } catch {}
      }
      resetToIdle();
      return textResponse('Session ended. Quorum tools are now idle.');
    }
  );

  // --- CONTEXT TOOLS (9 tools) ---
  // Each checks for active session, then dispatches appropriately

  server.tool(
    'get_context',
    'Get shared project context including decisions, interfaces, and dependencies',
    { filter: z.enum(['decisions', 'interfaces', 'dependencies', 'all']).optional() },
    async ({ filter }) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('get_context', { filter });
      return jsonResponse(result);
    }
  );

  server.tool(
    'post_decision',
    'Record an architecture or design decision for the team',
    {
      title: z.string(),
      description: z.string(),
      rationale: z.string(),
      author: z.string(),
      tags: z.array(z.string()).optional(),
    },
    async (args) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('post_decision', args);
      return jsonResponse(result);
    }
  );

  server.tool(
    'flag_dependency',
    'Declare a dependency on another team member\'s work',
    {
      from: z.string(),
      to: z.string(),
      description: z.string(),
      priority: z.enum(['blocking', 'nice-to-have']),
    },
    async (args) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('flag_dependency', args);
      return jsonResponse(result);
    }
  );

  server.tool(
    'get_dependencies',
    'View all declared dependencies and their resolution status',
    {
      member: z.string().optional(),
      status: z.enum(['open', 'resolved']).optional(),
    },
    async (args) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('get_dependencies', args);
      return jsonResponse(result);
    }
  );

  server.tool(
    'sync',
    'Get a full snapshot of the current session state and all members',
    {},
    async () => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('sync', {});
      return jsonResponse(result);
    }
  );

  server.tool(
    'post_interface',
    'Define an API contract or interface between two components',
    {
      name: z.string(),
      between: z.tuple([z.string(), z.string()]),
      specification: z.string(),
      author: z.string(),
    },
    async (args) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('post_interface', args);
      return jsonResponse(result);
    }
  );

  server.tool(
    'resolve_dependency',
    'Mark a flagged dependency as resolved with a resolution description',
    {
      dependencyId: z.string(),
      resolution: z.string(),
    },
    async (args) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('resolve_dependency', args);
      return jsonResponse(result);
    }
  );

  server.tool(
    'raise_conflict',
    'Flag that two decisions or interfaces are in conflict and need resolution',
    {
      itemIds: z.tuple([z.string(), z.string()]),
      description: z.string(),
      author: z.string(),
    },
    async (args) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('raise_conflict', args);
      return jsonResponse(result);
    }
  );

  server.tool(
    'resolve_conflict',
    'Resolve a conflict, optionally superseding one of the conflicting decisions',
    {
      conflictId: z.string(),
      resolution: z.string(),
      supersedes: z.string().optional(),
    },
    async (args) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('resolve_conflict', args);
      return jsonResponse(result);
    }
  );

  return { server, getState: () => state, resetToIdle };
}

export async function serveCommand() {
  const { server } = createServeServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && npx vitest run src/__tests__/serve.test.ts`
Expected: PASS — all 4 tests

**Step 5: Commit**

```bash
git add packages/cli/src/commands/serve.ts packages/cli/src/__tests__/serve.test.ts
git commit -m "feat: add serve command with stateful MCP server and 13 tools"
```

---

### Task 4: Integration test — host context tools via serve

Test that a host can start a session and use context tools locally, without needing a relay (test the hosting path's direct ContextStore execution).

**Files:**
- Modify: `packages/cli/src/__tests__/serve.test.ts`

**Step 1: Write the failing test**

Add to the existing `serve.test.ts`, in a new describe block:

```typescript
import { createRelay } from '@quorum/relay';

describe('serve: host context tools via relay', () => {
  let relay: ReturnType<typeof createRelay>;
  let client: Client;
  let cleanup: () => Promise<void>;
  const TEST_PORT = 9879;

  beforeEach(async () => {
    // Set relay URL for tests
    process.env['QUORUM_RELAY_URL'] = `ws://localhost:${TEST_PORT}`;
    relay = createRelay(TEST_PORT);
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
      delete process.env['QUORUM_RELAY_URL'];
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
```

**Step 2: Run test to verify it fails or passes**

Run: `cd packages/cli && npx vitest run src/__tests__/serve.test.ts`

Note: This test requires network access (WebSocket). If running in sandbox, use `dangerouslyDisableSandbox: true`.

Expected: PASS if serve.ts is correct. If there are issues, debug and fix.

**Step 3: Commit**

```bash
git add packages/cli/src/__tests__/serve.test.ts
git commit -m "test: add integration test for host context tools via serve"
```

---

### Task 5: Integration test — member forwarding via relay

Test the full flow: host starts session via serve, member joins via another serve instance, member's tool calls are forwarded through relay to host.

**Files:**
- Modify: `packages/cli/src/__tests__/serve.test.ts`

**Step 1: Write the failing test**

Add a new describe block:

```typescript
describe('serve: member tool forwarding via relay', () => {
  let relay: ReturnType<typeof createRelay>;
  let hostClient: Client;
  let memberClient: Client;
  let cleanup: () => Promise<void>;
  const TEST_PORT = 9880;

  beforeEach(async () => {
    process.env['QUORUM_RELAY_URL'] = `ws://localhost:${TEST_PORT}`;
    relay = createRelay(TEST_PORT);
    await relay.start();

    const hostServe = createServeServer();
    hostClient = new Client({ name: 'host-client', version: '1.0.0' });
    const [hClientTransport, hServerTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      hostClient.connect(hClientTransport),
      hostServe.server.connect(hServerTransport),
    ]);

    const memberServe = createServeServer();
    memberClient = new Client({ name: 'member-client', version: '1.0.0' });
    const [mClientTransport, mServerTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      memberClient.connect(mClientTransport),
      memberServe.server.connect(mServerTransport),
    ]);

    cleanup = async () => {
      await hostClient.close();
      await memberClient.close();
      await hostServe.server.close();
      await memberServe.server.close();
      await relay.stop();
      delete process.env['QUORUM_RELAY_URL'];
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  it('member can post a decision that is stored on the host', async () => {
    // Host starts session
    const startResult = await hostClient.callTool({ name: 'quorum_start', arguments: { name: 'Alice' } });
    const startData = JSON.parse((startResult.content as Array<{ text: string }>)[0]!.text);
    const sessionId = startData.sessionId;

    // Member joins
    const joinResult = await memberClient.callTool({ name: 'quorum_join', arguments: { sessionId, name: 'Bob' } });
    const joinData = JSON.parse((joinResult.content as Array<{ text: string }>)[0]!.text);
    expect(joinData.status).toBe('joined');

    // Member posts a decision (forwarded through relay to host)
    const decisionResult = await memberClient.callTool({
      name: 'post_decision',
      arguments: {
        title: 'Use Postgres',
        description: 'Postgres for database',
        rationale: 'Reliable and scalable',
        author: 'Bob',
      },
    });
    const decisionData = JSON.parse((decisionResult.content as Array<{ text: string }>)[0]!.text);
    expect(decisionData.id).toBeDefined();

    // Verify the decision exists on the host
    const ctxResult = await hostClient.callTool({ name: 'get_context', arguments: {} });
    const ctxData = JSON.parse((ctxResult.content as Array<{ text: string }>)[0]!.text);
    expect(ctxData.decisions).toHaveLength(1);
    expect(ctxData.decisions[0].title).toBe('Use Postgres');
    expect(ctxData.decisions[0].author).toBe('Bob');
  });
});
```

**Step 2: Run tests**

Run: `cd packages/cli && npx vitest run src/__tests__/serve.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/cli/src/__tests__/serve.test.ts
git commit -m "test: add member tool forwarding integration test"
```

---

### Task 6: Clean up old files and update exports

Remove the deprecated files and update the CLI package.

**Files:**
- Delete: `packages/cli/src/commands/start.ts`
- Delete: `packages/cli/src/commands/join.ts`
- Delete: `packages/cli/src/commands/status.ts`
- Delete: `packages/cli/src/proxy/mcp-proxy.ts`
- Modify: `packages/cli/src/index.ts` — remove old command imports
- Remove: `packages/cli/src/__tests__/integration.test.ts` — replaced by serve tests

**Step 1: Delete deprecated files**

```bash
rm packages/cli/src/commands/start.ts
rm packages/cli/src/commands/join.ts
rm packages/cli/src/commands/status.ts
rm packages/cli/src/proxy/mcp-proxy.ts
rm packages/cli/src/__tests__/integration.test.ts
```

**Step 2: Verify the index.ts no longer imports deleted files**

The index.ts from Task 2 already removed the old imports. Verify with:

Run: `cd packages/cli && npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests**

Run: `npm test` (from repo root)
Expected: All tests pass across all packages

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated start, join, status, proxy files"
```

---

### Task 7: Update README and CLAUDE.md

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README**

Update the Usage section to reflect the new workflow:
- `quorum install` / `quorum install --project`
- Restart Claude Code
- Use `quorum_start`, `quorum_join` tools from within Claude Code
- Remove the old "Starting a session (host)" / "Joining a session (teammate)" terminal-based instructions
- Keep the relay section (still needed for hosted infrastructure)
- Update project structure to mention `serve.ts` instead of `start.ts`/`join.ts`

**Step 2: Update CLAUDE.md**

Update architecture description to mention the `serve` command and inline MCP workflow.

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update README and CLAUDE.md for inline MCP workflow"
```

---

Plan complete and saved to `docs/plans/2026-03-05-inline-mcp-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?