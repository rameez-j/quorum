# Quorum — Design Document

**Date:** 2026-03-04
**Status:** Approved

## Overview

Quorum is an MCP-based shared context server that keeps team members' AI agents in sync during collaborative projects. It solves "agentic drift" — the invisible divergence that happens when parallel autonomous agents work on related parts of a codebase without coordination.

**Core value proposition:** Any time a group of people are working on different parts of the same thing, their individual agents stay coherent with each other.

## Target Users

- Student and hackathon teams (most AI-native, low tolerance for complex tooling)
- Small startup teams (same pain, more at stake)
- Anyone in a group of 2–10 working on a joint project with AI agents

**Not targeting (for now):** Enterprise teams with compliance/procurement requirements.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Hosted Relay Server                   │
│              (wss://relay.quorum.dev)                    │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│  │ Room A  │  │ Room B  │  │ Room C  │  ...            │
│  │(session)│  │(session)│  │(session)│                  │
│  └─────────┘  └─────────┘  └─────────┘                │
└───────────┬────────────────────┬────────────────────────┘
            │                    │
        WebSocket            WebSocket
            │                    │
┌───────────▼──────────┐  ┌─────▼──────────────────┐
│   Host (Person A)     │  │  Teammate (Person B)    │
│                       │  │                         │
│  ┌─────────────────┐  │  │  ┌───────────────────┐  │
│  │  Quorum Server   │  │  │  │  Quorum Proxy     │  │
│  │  (MCP Server)    │  │  │  │  (Local MCP)      │  │
│  │                  │  │  │  │                   │  │
│  │  ┌────────────┐  │  │  │  │  Forwards tool    │  │
│  │  │ Context    │  │  │  │  │  calls through    │  │
│  │  │ Store      │  │  │  │  │  relay to host    │  │
│  │  │ (JSON)     │  │  │  │  └───────┬───────────┘  │
│  │  └────────────┘  │  │  │          │              │
│  └──────┬───────────┘  │  │  ┌───────▼───────────┐  │
│         │              │  │  │  Claude Code       │  │
│  ┌──────▼───────────┐  │  │  │  (uses MCP tools)  │  │
│  │  Claude Code     │  │  │  └───────────────────┘  │
│  │  (uses MCP tools)│  │  │                         │
│  └──────────────────┘  │  └─────────────────────────┘
└──────────────────────┘
```

**Key principles:**
- Relay is stateless — just routes messages between clients in the same session
- All state (decisions, dependencies, interfaces) lives on the host's machine in JSON files
- Each teammate runs a local MCP proxy that Claude Code connects to via stdio
- Host runs the real MCP server directly (no proxy needed)

## Connectivity

Quorum uses a hosted WebSocket relay server for connectivity. The relay:
- Accepts WebSocket connections from clients
- Groups connections by session ID
- Forwards messages between clients in the same session
- Stores no data (stateless)

Users connect with clean session IDs (e.g., `abc123`), no IP addresses or tunnel URLs.

**Scaling:** A single server handles thousands of concurrent sessions. Horizontal scaling via load balancer + Redis pub/sub if needed. Regional deployment for latency optimization at scale.

**Future flexibility:** The relay is isolated in its own package, making it straightforward to swap transport mechanisms (P2P, tunneling, direct connection) without touching the MCP server or CLI.

## Monorepo Structure

```
quorum/
├── packages/
│   ├── cli/                    # `quorum` npm package — what users install
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── start.ts    # quorum start
│   │   │   │   ├── join.ts     # quorum join <id>
│   │   │   │   ├── stop.ts     # quorum stop
│   │   │   │   ├── status.ts   # quorum status
│   │   │   │   └── export.ts   # quorum export
│   │   │   ├── proxy/
│   │   │   │   └── mcp-proxy.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── server/                 # @quorum/server — MCP server + context store
│   │   ├── src/
│   │   │   ├── mcp/
│   │   │   │   ├── tools.ts
│   │   │   │   └── server.ts
│   │   │   ├── store/
│   │   │   │   ├── context.ts
│   │   │   │   └── types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── relay/                  # @quorum/relay — hosted WebSocket relay
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── shared/                 # @quorum/shared — shared types and protocol
│       ├── src/
│       │   ├── protocol.ts
│       │   └── types.ts
│       └── package.json
│
├── turbo.json
├── package.json
└── tsconfig.base.json
```

- `@quorum/shared` contains protocol and type definitions used across all packages
- `quorum` (CLI) is the only user-facing package
- `@quorum/relay` is independently deployable (Dockerfile included)
- Build ordering managed by turborepo: shared → server → relay/cli

## Protocol

All communication flows as JSON messages over WebSocket through the relay.

### Message Types

```typescript
// Client → Relay
{ type: "create_session", payload: { hostId: string } }
{ type: "join_session",   payload: { sessionId: string, memberId: string, name: string } }
{ type: "tool_request",   payload: { requestId: string, tool: string, args: object } }
{ type: "tool_response",  payload: { requestId: string, result: object } }
{ type: "leave_session",  payload: { memberId: string } }

// Relay → Client
{ type: "session_created",  payload: { sessionId: string } }
{ type: "member_joined",    payload: { memberId: string, name: string } }
{ type: "member_left",      payload: { memberId: string } }
{ type: "tool_request",     payload: { requestId: string, tool: string, args: object } }
{ type: "tool_response",    payload: { requestId: string, result: object } }
```

### Tool Call Flow

```
1. Teammate's Claude Code calls tool on local proxy
2. Proxy sends tool_request through WebSocket to relay
3. Relay forwards tool_request to host
4. Host's MCP server executes the tool, writes to JSON store
5. Host sends tool_response back through relay
6. Relay forwards tool_response to teammate's proxy
7. Proxy returns result to Claude Code
```

Request/response correlation via `requestId` supports concurrent tool calls.

## MCP Tools (9 tools)

### 1. `get_context`
Returns the full shared state.
```
Input:  { filter?: "decisions" | "interfaces" | "dependencies" | "all" }
Output: { brief: string, decisions: Decision[], interfaces: Interface[],
          dependencies: Dependency[], members: Member[] }
```

### 2. `post_decision`
Records an architectural/design decision.
```
Input:  { title: string, description: string, rationale: string,
          author: string, tags?: string[] }
Output: { id: string, timestamp: string }
```

### 3. `flag_dependency`
Declares a dependency on another member's work.
```
Input:  { from: string, to: string, description: string,
          priority: "blocking" | "nice-to-have" }
Output: { id: string, status: "open" }
```

### 4. `get_dependencies`
Returns all declared dependencies.
```
Input:  { filter?: { member?: string, status?: "open" | "resolved" } }
Output: { dependencies: Dependency[] }
```

### 5. `sync`
Full snapshot of session state and member status.
```
Input:  {}
Output: { members: MemberStatus[], recentDecisions: Decision[],
          openDependencies: Dependency[], unresolvedInterfaces: Interface[] }
```

### 6. `post_interface`
Defines an API contract between components.
```
Input:  { name: string, between: [string, string], specification: string,
          author: string }
Output: { id: string, status: "proposed" }
```

### 7. `resolve_dependency`
Marks a dependency as resolved.
```
Input:  { dependencyId: string, resolution: string }
Output: { id: string, status: "resolved" }
```

### 8. `raise_conflict`
Flags conflicting decisions or interfaces.
```
Input:  { itemIds: [string, string], description: string, author: string }
Output: { id: string, status: "open" }
```

### 9. `resolve_conflict`
Resolves a conflict, optionally superseding a decision.
```
Input:  { conflictId: string, resolution: string, supersedes?: string }
Output: { id: string, status: "resolved" }
```

### Data Types

```typescript
type Decision = {
  id: string; title: string; description: string;
  rationale: string; author: string; timestamp: string;
  tags: string[]; supersededBy?: string;
}

type Dependency = {
  id: string; from: string; to: string; description: string;
  priority: "blocking" | "nice-to-have";
  status: "open" | "resolved"; resolution?: string;
  timestamp: string;
}

type Interface = {
  id: string; name: string; between: [string, string];
  specification: string; author: string;
  status: "proposed" | "agreed"; timestamp: string;
}

type Conflict = {
  id: string; itemIds: [string, string]; description: string;
  author: string; status: "open" | "resolved";
  resolution?: string; supersedes?: string; timestamp: string;
}

type Member = { id: string; name: string; connectedAt: string; }
```

## CLI Commands & User Experience

### Installation
```bash
npm install -g quorum
```

### One-time setup (for slash command support)
```bash
npx quorum install
# Registers Quorum as an MCP server in Claude Code config
```

### Session lifecycle

**Starting (host):**
```bash
$ quorum start
✓ MCP server started
✓ Connected to relay
✓ Session created: abc123
Share with your team: quorum join abc123
```

**Joining (teammate):**
```bash
$ quorum join abc123
✓ Connected to session abc123
✓ Local MCP proxy started
✓ MCP server registered in Claude Code
Members in session: Alice (host), You
```

**Ending:**
```bash
$ quorum stop
✓ Generating .collab/context.md...
✓ Session context saved
✓ Disconnected from relay
```

**Other commands:**
```bash
quorum status            # Show session info, who's connected
quorum export            # Generate .collab/context.md without ending session
```

### Claude Code slash commands

After `quorum install`, these are available inside Claude Code:
- `/quorum-start` — start a session
- `/quorum-join <session-id>` — join a session
- `/quorum-status` — show session info
- `/quorum-stop` — end/leave session

### Claude Code integration

The MCP tools appear alongside Claude Code's built-in tools. Agents use them naturally during conversation — no explicit prompting needed. A developer says "check what the team has decided about the database" and the agent calls `get_context`.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Host disconnects | Teammates notified. Tools return errors until host reconnects. Context preserved on disk. |
| Teammate disconnects | Others notified. Can rejoin with same session ID and get full context. |
| Relay goes down | Connections drop. Auto-retry with exponential backoff. Session state safe on host. |
| Conflicting decisions | Both recorded. Use `raise_conflict` to surface. Team resolves via `resolve_conflict`. |
| Host loses power | Context on disk. `quorum start --resume` reloads last session state. |
| Session ID collision | Relay generates short UUIDs. On collision, generates new ID. |

**Philosophy:** Surface problems, don't solve them. The tool makes conflicts and dependencies visible; the team makes the decisions.

## Context Export

On session end or `quorum export`, generates `.collab/context.md`:

```markdown
# Project Context — Session abc123
Generated: 2026-03-04T14:30:00Z

## Brief
[Original brief text]

## Team
- Alice (host) — Auth service
- Bob — User service

## Decisions
### #1: Use JWT for authentication (Alice)
- **Rationale:** Stateless, scales horizontally
- **Tags:** auth, security

## Interfaces
### User API (User Service ↔ Auth Service)
- **Status:** agreed
- **Spec:** GET /users/:id returns { id, email, role }

## Dependencies
### Auth → User Service: needs user lookup endpoint
- **Status:** resolved
- **Resolution:** Agreed on GET /users/:id

## Conflicts (resolved)
### REST vs GraphQL
- **Resolution:** GraphQL chosen for frontend flexibility
```

File is generated locally. User decides when/whether to commit to git.

## Tech Stack

- **Language:** TypeScript (Node.js)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **WebSocket:** `ws` library
- **CLI framework:** TBD (commander, oclif, or yargs)
- **Build:** turborepo for workspace management
- **Storage:** JSON files on host's filesystem
- **Distribution:** npm (`quorum`)
- **Relay hosting:** TBD (Fly.io, Railway, or similar)
