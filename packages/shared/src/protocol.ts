// Client → Relay
export interface CreateSessionMessage {
  type: 'create_session';
  payload: { hostId: string; name: string };
}

export interface JoinSessionMessage {
  type: 'join_session';
  payload: { sessionId: string; memberId: string; name: string };
}

export interface ToolRequestMessage {
  type: 'tool_request';
  payload: { requestId: string; tool: string; args: Record<string, unknown> };
}

export interface ToolResponseMessage {
  type: 'tool_response';
  payload: { requestId: string; result: unknown; error?: string };
}

export interface LeaveSessionMessage {
  type: 'leave_session';
  payload: { memberId: string };
}

// Relay → Client
export interface SessionCreatedMessage {
  type: 'session_created';
  payload: { sessionId: string };
}

export interface MemberJoinedMessage {
  type: 'member_joined';
  payload: { memberId: string; name: string };
}

export interface MemberLeftMessage {
  type: 'member_left';
  payload: { memberId: string; name: string };
}

export interface ErrorMessage {
  type: 'error';
  payload: { message: string };
}

export type ClientMessage =
  | CreateSessionMessage
  | JoinSessionMessage
  | ToolRequestMessage
  | ToolResponseMessage
  | LeaveSessionMessage;

export type RelayMessage =
  | SessionCreatedMessage
  | MemberJoinedMessage
  | MemberLeftMessage
  | ToolRequestMessage
  | ToolResponseMessage
  | ErrorMessage;
