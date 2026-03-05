import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import WebSocket from 'ws';
import { join } from 'node:path';
import { ContextStore, createToolDispatcher } from '@quorum/server';
import type { ClientMessage, RelayMessage, Member } from '@quorum/shared';
import { generateId } from '@quorum/shared';
import { RELAY_URL } from '../config.js';

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type SessionState =
  | { mode: 'idle' }
  | {
      mode: 'hosting';
      sessionId: string;
      ws: WebSocket;
      store: ContextStore;
      dispatch: ReturnType<typeof createToolDispatcher>;
      members: Member[];
    }
  | {
      mode: 'joined';
      sessionId: string;
      ws: WebSocket;
      memberId: string;
      pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function textResponse(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

function idleError() {
  return textResponse('No active session. Use quorum_start or quorum_join first.');
}

function alreadyActiveError(sessionId: string) {
  return textResponse(`Already in session ${sessionId}. Use quorum_stop first.`);
}

function connectToRelay(): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(RELAY_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Unable to connect. Please try again later.'));
    }, 10_000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function waitForMessage<T extends RelayMessage['type']>(
  ws: WebSocket,
  type: T,
): Promise<Extract<RelayMessage, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${type}`));
    }, 10_000);

    const handler = (data: WebSocket.Data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;
      if (msg.type === type) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(msg as Extract<RelayMessage, { type: T }>);
      }
    };
    ws.on('message', handler);
  });
}

function sendMessage(ws: WebSocket, msg: ClientMessage) {
  ws.send(JSON.stringify(msg));
}

// ---------------------------------------------------------------------------
// createServeServer — the core factory (exported for testing)
// ---------------------------------------------------------------------------

export function createServeServer() {
  let state: SessionState = { mode: 'idle' };

  const server = new McpServer({
    name: 'quorum',
    version: '0.1.0',
  });

  // -- State helpers --------------------------------------------------------

  function resetToIdle() {
    if (state.mode !== 'idle') {
      try {
        if (state.ws.readyState === WebSocket.OPEN) {
          state.ws.close();
        }
      } catch {
        // ignore close errors
      }
    }
    state = { mode: 'idle' };
  }

  function setupHostMessageHandler(
    ws: WebSocket,
    dispatch: ReturnType<typeof createToolDispatcher>,
    members: Member[],
  ) {
    ws.on('message', async (data) => {
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
          const idx = members.findIndex((m) => m.id === msg.payload.memberId);
          if (idx !== -1) members.splice(idx, 1);
          break;
        }

        case 'tool_request': {
          try {
            const result = await dispatch(msg.payload.tool, msg.payload.args);
            const response: ClientMessage = {
              type: 'tool_response',
              payload: { requestId: msg.payload.requestId, result },
            };
            sendMessage(ws, response);
          } catch (err) {
            const response: ClientMessage = {
              type: 'tool_response',
              payload: {
                requestId: msg.payload.requestId,
                result: null,
                error: err instanceof Error ? err.message : String(err),
              },
            };
            sendMessage(ws, response);
          }
          break;
        }
      }
    });
  }

  function setupMemberMessageHandler(
    ws: WebSocket,
    pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>,
  ) {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;

      switch (msg.type) {
        case 'tool_response': {
          const pending = pendingRequests.get(msg.payload.requestId);
          if (pending) {
            pendingRequests.delete(msg.payload.requestId);
            if (msg.payload.error) {
              pending.reject(new Error(msg.payload.error));
            } else {
              pending.resolve(msg.payload.result);
            }
          }
          break;
        }

        case 'member_joined':
        case 'member_left':
          // Member doesn't track the member list directly
          break;
      }
    });

    ws.on('close', () => {
      // Reject all pending requests
      for (const [, pending] of pendingRequests) {
        pending.reject(new Error('Connection to host lost'));
      }
      pendingRequests.clear();
      resetToIdle();
    });
  }

  function forwardToHost(tool: string, args: Record<string, unknown>): Promise<unknown> {
    if (state.mode !== 'joined') {
      throw new Error('Not in joined mode');
    }

    const requestId = generateId();
    const { ws, pendingRequests } = state;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('Request timed out'));
      }, 30_000);

      pendingRequests.set(requestId, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      const msg: ClientMessage = {
        type: 'tool_request',
        payload: { requestId, tool, args },
      };
      sendMessage(ws, msg);
    });
  }

  async function executeContextTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
    if (state.mode === 'hosting') {
      return state.dispatch(tool, args);
    }
    if (state.mode === 'joined') {
      return forwardToHost(tool, args);
    }
    throw new Error('No active session');
  }

  // -- Session tools --------------------------------------------------------

  server.tool(
    'quorum_start',
    'Start a new Quorum collaboration session as host',
    {
      name: z.string(),
    },
    async ({ name }) => {
      if (state.mode !== 'idle') {
        return alreadyActiveError(state.sessionId);
      }

      let ws: WebSocket;
      try {
        ws = await connectToRelay();
      } catch {
        return textResponse('Unable to connect. Please try again later.');
      }

      const hostId = generateId();
      sendMessage(ws, { type: 'create_session', payload: { hostId, name } });

      const created = await waitForMessage(ws, 'session_created');
      const sessionId = created.payload.sessionId;

      const storeDir = join(process.cwd(), '.collab');
      const store = new ContextStore(storeDir);
      const dispatch = createToolDispatcher(store);
      const members: Member[] = [];

      setupHostMessageHandler(ws, dispatch, members);

      state = { mode: 'hosting', sessionId, ws, store, dispatch, members };

      return jsonResponse({ status: 'hosting', sessionId });
    },
  );

  server.tool(
    'quorum_join',
    'Join an existing Quorum collaboration session',
    {
      sessionId: z.string(),
      name: z.string(),
    },
    async ({ sessionId, name }) => {
      if (state.mode !== 'idle') {
        return alreadyActiveError(state.sessionId);
      }

      let ws: WebSocket;
      try {
        ws = await connectToRelay();
      } catch {
        return textResponse('Unable to connect. Please try again later.');
      }

      const memberId = generateId();
      sendMessage(ws, {
        type: 'join_session',
        payload: { sessionId, memberId, name },
      });

      await waitForMessage(ws, 'member_joined');

      const pendingRequests = new Map<
        string,
        { resolve: (v: unknown) => void; reject: (e: Error) => void }
      >();

      setupMemberMessageHandler(ws, pendingRequests);

      state = { mode: 'joined', sessionId, ws, memberId, pendingRequests };

      return jsonResponse({ status: 'joined', sessionId });
    },
  );

  server.tool(
    'quorum_status',
    'Check the current Quorum session status',
    {},
    async () => {
      if (state.mode === 'idle') {
        return jsonResponse({ status: 'idle' });
      }
      if (state.mode === 'hosting') {
        return jsonResponse({
          status: 'hosting',
          sessionId: state.sessionId,
          members: state.members,
        });
      }
      return jsonResponse({ status: 'joined', sessionId: state.sessionId });
    },
  );

  server.tool(
    'quorum_stop',
    'Stop the current Quorum session',
    {},
    async () => {
      if (state.mode === 'idle') {
        return textResponse('No active session.');
      }
      if (state.mode === 'joined') {
        sendMessage(state.ws, {
          type: 'leave_session',
          payload: { memberId: state.memberId },
        });
      }
      resetToIdle();
      return textResponse('Session ended.');
    },
  );

  // -- Context tools --------------------------------------------------------

  server.tool(
    'get_context',
    'Get shared project context including decisions, interfaces, and dependencies',
    {
      filter: z.enum(['decisions', 'interfaces', 'dependencies', 'all']).optional(),
    },
    async ({ filter }) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('get_context', filter ? { filter } : {});
      return jsonResponse(result);
    },
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
    async ({ title, description, rationale, author, tags }) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('post_decision', {
        title,
        description,
        rationale,
        author,
        tags,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    'flag_dependency',
    "Declare a dependency on another team member's work",
    {
      from: z.string(),
      to: z.string(),
      description: z.string(),
      priority: z.enum(['blocking', 'nice-to-have']),
    },
    async ({ from, to, description, priority }) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('flag_dependency', {
        from,
        to,
        description,
        priority,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    'get_dependencies',
    'View all declared dependencies and their resolution status',
    {
      member: z.string().optional(),
      status: z.enum(['open', 'resolved']).optional(),
    },
    async ({ member, status }) => {
      if (state.mode === 'idle') return idleError();
      const args: Record<string, unknown> = {};
      if (member) args.member = member;
      if (status) args.status = status;
      const result = await executeContextTool('get_dependencies', args);
      return jsonResponse(result);
    },
  );

  server.tool(
    'sync',
    'Get a full snapshot of the current session state and all members',
    {},
    async () => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('sync', {});
      return jsonResponse(result);
    },
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
    async ({ name, between, specification, author }) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('post_interface', {
        name,
        between,
        specification,
        author,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    'resolve_dependency',
    'Mark a flagged dependency as resolved with a resolution description',
    {
      dependencyId: z.string(),
      resolution: z.string(),
    },
    async ({ dependencyId, resolution }) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('resolve_dependency', {
        dependencyId,
        resolution,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    'raise_conflict',
    'Flag that two decisions or interfaces are in conflict and need resolution',
    {
      itemIds: z.tuple([z.string(), z.string()]),
      description: z.string(),
      author: z.string(),
    },
    async ({ itemIds, description, author }) => {
      if (state.mode === 'idle') return idleError();
      const result = await executeContextTool('raise_conflict', {
        itemIds,
        description,
        author,
      });
      return jsonResponse(result);
    },
  );

  server.tool(
    'resolve_conflict',
    'Resolve a conflict, optionally superseding one of the conflicting decisions',
    {
      conflictId: z.string(),
      resolution: z.string(),
      supersedes: z.string().optional(),
    },
    async ({ conflictId, resolution, supersedes }) => {
      if (state.mode === 'idle') return idleError();
      const args: Record<string, unknown> = { conflictId, resolution };
      if (supersedes) args.supersedes = supersedes;
      const result = await executeContextTool('resolve_conflict', args);
      return jsonResponse(result);
    },
  );

  // -- Return factory result ------------------------------------------------

  return {
    server: server as unknown as { connect: (transport: unknown) => Promise<void>; close: () => Promise<void> },
    getState: () => state,
    resetToIdle,
  };
}

// ---------------------------------------------------------------------------
// serveCommand — CLI entry point
// ---------------------------------------------------------------------------

export async function serveCommand() {
  const { server } = createServeServer();
  const transport = new StdioServerTransport();
  await (server as unknown as { connect: (transport: StdioServerTransport) => Promise<void> }).connect(transport);
}
