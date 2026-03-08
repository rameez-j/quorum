# Inline MCP Server — Design Document

**Date:** 2026-03-05
**Status:** Approved

## Overview

Replace the current multi-terminal CLI workflow (relay + host + member in separate terminals) with a single MCP server process that Claude Code manages via stdio. Users interact entirely through MCP tools inside Claude Code — no separate terminals needed.

## Problem

The current implementation requires:
1. Starting the relay server in a separate terminal
2. Running `quorum start` in another terminal (host)
3. Running `quorum join` in another terminal (member)
4. None of these integrate with Claude Code's MCP server discovery

This makes Quorum unusable in practice. Users should be able to start and use Quorum entirely from within Claude Code.

## Solution

### Architecture

```
Claude Code spawns: quorum serve (via stdio)
        │
        ▼
┌─────────────────────────────┐
│  Quorum MCP Server Process  │
│                             │
│  State: IDLE / HOSTING /    │
│         JOINED              │
│                             │
│  IDLE tools:                │
│    quorum_start             │
│    quorum_join              │
│    quorum_status            │
│                             │
│  ACTIVE tools (+ above):   │
│    quorum_stop              │
│    get_context              │
│    post_decision            │
│    flag_dependency          │
│    ... (9 context tools)    │
│                             │
│  WebSocket ◄──► Relay       │
└─────────────────────────────┘
```

### Setup Flow

1. User installs quorum: `npm install -g quorum`
2. User runs: `quorum install` (global) or `quorum install --project` (project-level)
3. This writes to Claude Code settings:
   ```json
   {
     "mcpServers": {
       "quorum": {
         "command": "npx",
         "args": ["-y", "quorum", "serve"]
       }
     }
   }
   ```
4. User restarts Claude Code — quorum tools are available

### Server Lifecycle

```
IDLE ──quorum_start──▶ HOSTING
IDLE ──quorum_join───▶ JOINED
HOSTING ──quorum_stop──▶ IDLE
JOINED ──quorum_stop───▶ IDLE
```

The process stays running across session start/stop cycles. No Claude Code restart needed between sessions.

### Tool Definitions

**Session management tools:**

| Tool | Input | When idle | When active |
|------|-------|-----------|-------------|
| `quorum_start` | `{ name: string }` | Connect to relay, create session, return session ID | Error: "Already in session {id}. Use quorum_stop first." |
| `quorum_join` | `{ sessionId: string, name: string }` | Connect to relay, join session | Error: "Already in session {id}. Use quorum_stop first." |
| `quorum_status` | `{}` | Return "No active session." | Return session ID, role, connected members |
| `quorum_stop` | `{}` | Error: "No active session." | Disconnect from relay, return to idle |

**Context tools (9 existing tools):**
- When idle: return "No active session. Use quorum_start or quorum_join first."
- When hosting: execute directly against ContextStore
- When joined: forward through relay to host via WebSocket

All 13 tools are registered at startup. Behavior changes based on server state.

### Host vs Member Behavior

**Host (quorum_start):**
- Creates ContextStore in `.collab/` directory
- Connects to relay WebSocket, sends `create_session`
- Context tool calls execute locally via tool dispatcher
- Receives `tool_request` from relay (member calls), dispatches locally, sends `tool_response` back

**Member (quorum_join):**
- Connects to relay WebSocket, sends `join_session`
- Context tool calls are forwarded as `tool_request` through relay to host
- Waits for `tool_response` with 30s timeout and `requestId` correlation

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Context tool when idle | "No active session. Use quorum_start or quorum_join first." |
| start/join when active | "Already in session {id}. Use quorum_stop first." |
| Relay unreachable | "Unable to connect. Please try again later." |
| Host disconnects (member) | Notified, context tools return "Host disconnected. Session ended." Return to idle. |
| WebSocket drops | Auto-reconnect with exponential backoff (3 attempts). If all fail, return to idle. |
| stop when idle | "No active session." |

### Install/Uninstall Commands

```bash
quorum install            # Register in ~/.claude/settings.json
quorum install --project  # Register in .claude/settings.json (project-level)
quorum uninstall          # Remove from ~/.claude/settings.json
quorum uninstall --project # Remove from .claude/settings.json
```

## What Changes

**New:**
- `packages/cli/src/commands/serve.ts` — stateful MCP server with session management and all 13 tools

**Modified:**
- `packages/cli/src/index.ts` — add `serve`, `install`, `uninstall` commands
- `packages/cli/src/config.ts` — support global vs project-level, remove proxy port, add uninstall

**Removed/deprecated:**
- `packages/cli/src/proxy/mcp-proxy.ts` — no longer needed
- `packages/cli/src/commands/start.ts` — replaced by `quorum_start` tool in serve
- `packages/cli/src/commands/join.ts` — replaced by `quorum_join` tool in serve

**Reused as-is:**
- `@quorum/relay` — no changes
- `@quorum/shared` — no changes
- `@quorum/server` — ContextStore, tool dispatcher, tool schemas

## Future

- Hosted relay at `wss://relay.quorum.dev` so users never think about infrastructure
- Direct peer-to-peer connections (LAN auto-detect, relay as fallback)
- `quorum start --resume` to reload previous session context
