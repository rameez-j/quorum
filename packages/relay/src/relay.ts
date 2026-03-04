import { WebSocketServer, WebSocket } from 'ws';
import { generateId } from '@quorum/shared';
import type { ClientMessage, RelayMessage } from '@quorum/shared';

interface Session {
  id: string;
  host: WebSocket;
  members: Map<string, WebSocket>;
}

export function createRelay(port: number) {
  let wss: WebSocketServer;
  const sessions = new Map<string, Session>();
  const clientSessions = new Map<WebSocket, string>();
  const clientRoles = new Map<WebSocket, 'host' | 'member'>();

  function broadcast(session: Session, message: RelayMessage, exclude?: WebSocket) {
    const data = JSON.stringify(message);
    if (session.host !== exclude) {
      session.host.send(data);
    }
    for (const memberWs of session.members.values()) {
      if (memberWs !== exclude) {
        memberWs.send(data);
      }
    }
  }

  function sendTo(ws: WebSocket, message: RelayMessage) {
    ws.send(JSON.stringify(message));
  }

  function handleMessage(ws: WebSocket, msg: ClientMessage) {
    switch (msg.type) {
      case 'create_session': {
        const sessionId = generateId();
        const session: Session = {
          id: sessionId,
          host: ws,
          members: new Map(),
        };
        sessions.set(sessionId, session);
        clientSessions.set(ws, sessionId);
        clientRoles.set(ws, 'host');
        sendTo(ws, { type: 'session_created', payload: { sessionId } });
        break;
      }

      case 'join_session': {
        const session = sessions.get(msg.payload.sessionId);
        if (!session) {
          sendTo(ws, { type: 'error', payload: { message: 'Session not found' } });
          return;
        }
        session.members.set(msg.payload.memberId, ws);
        clientSessions.set(ws, session.id);
        clientRoles.set(ws, 'member');
        broadcast(session, {
          type: 'member_joined',
          payload: { memberId: msg.payload.memberId, name: msg.payload.name },
        });
        break;
      }

      case 'tool_request': {
        const sessionId = clientSessions.get(ws);
        if (!sessionId) return;
        const session = sessions.get(sessionId);
        if (!session) return;
        sendTo(session.host, {
          type: 'tool_request',
          payload: msg.payload,
        });
        break;
      }

      case 'tool_response': {
        const sessionId = clientSessions.get(ws);
        if (!sessionId) return;
        const session = sessions.get(sessionId);
        if (!session) return;
        for (const memberWs of session.members.values()) {
          sendTo(memberWs, {
            type: 'tool_response',
            payload: msg.payload,
          });
        }
        break;
      }

      case 'leave_session': {
        const sessionId = clientSessions.get(ws);
        if (!sessionId) return;
        const session = sessions.get(sessionId);
        if (!session) return;
        session.members.delete(msg.payload.memberId);
        clientSessions.delete(ws);
        clientRoles.delete(ws);
        broadcast(session, {
          type: 'member_left',
          payload: { memberId: msg.payload.memberId, name: '' },
        });
        break;
      }
    }
  }

  return {
    start(): Promise<void> {
      return new Promise((resolve) => {
        wss = new WebSocketServer({ port });
        wss.on('connection', (ws) => {
          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data.toString()) as ClientMessage;
              handleMessage(ws, msg);
            } catch {
              sendTo(ws, { type: 'error', payload: { message: 'Invalid message' } });
            }
          });

          ws.on('close', () => {
            const sessionId = clientSessions.get(ws);
            if (!sessionId) return;
            const session = sessions.get(sessionId);
            if (!session) return;

            if (clientRoles.get(ws) === 'host') {
              for (const memberWs of session.members.values()) {
                sendTo(memberWs, {
                  type: 'error',
                  payload: { message: 'Host disconnected' },
                });
              }
              sessions.delete(sessionId);
            }
            clientSessions.delete(ws);
            clientRoles.delete(ws);
          });
        });
        wss.on('listening', resolve);
      });
    },

    stop(): Promise<void> {
      return new Promise((resolve) => {
        for (const client of wss.clients) {
          client.close();
        }
        wss.close(() => resolve());
      });
    },

    getSessionCount() {
      return sessions.size;
    },
  };
}
