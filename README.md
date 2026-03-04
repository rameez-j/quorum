# Quorum

Quorum is an MCP-based shared context server that keeps team members' AI agents in sync during collaborative projects. It solves **agentic drift** — the invisible divergence that happens when parallel autonomous agents work on related parts of a codebase without coordination.

When a group of 2-10 people are working on different parts of the same project, each using their own AI agent, Quorum keeps those agents coherent with each other.

## How It Works

```
┌──────────────────────────────────────────────────┐
│               WebSocket Relay Server             │
│                                                  │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│   │ Room A  │  │ Room B  │  │ Room C  │  ...     │
│   └─────────┘  └─────────┘  └─────────┘          │
└────────┬──────────────────────────┬──────────────┘
         │                          │
     WebSocket                  WebSocket
         │                          │
┌────────▼─────────────┐  ┌────────▼─────────────┐
│   Host (Alice)       │  │  Teammate (Bob)      │
│                      │  │                      │
│  Quorum MCP Server   │  │  Local MCP Proxy     │
│  + Context Store     │  │  (forwards to host)  │
│  (JSON files)        │  │                      │
│         │            │  │         │            │
│  Claude Code         │  │  Claude Code         │
└──────────────────────┘  └──────────────────────┘
```

One person **hosts** the session — their machine runs the MCP server and stores all shared context as JSON files. Teammates **join** the session — their machines run a local MCP proxy that forwards tool calls through a WebSocket relay to the host. The relay is stateless; it just routes messages between clients in the same session.

## MCP Tools

Quorum exposes 9 tools that AI agents can use naturally:

| Tool   |   Purpose   |
|--------|-------------|
| `get_context`        | Get shared project context (decisions, interfaces, dependencies) |
| `post_decision`      | Record an architectural or design decision |
| `flag_dependency`    | Declare a dependency on another member's work |
| `get_dependencies`   | View all declared dependencies |
| `sync`               | Full snapshot of session state and member status |
| `post_interface`     | Define an API contract between components |
| `resolve_dependency` | Mark a dependency as resolved |
| `raise_conflict`     | Flag conflicting decisions or interfaces |
| `resolve_conflict`   | Resolve a conflict, optionally superseding a decision |

These appear alongside Claude Code's built-in tools. An agent uses them naturally — a developer says "check what the team decided about the database" and the agent calls `get_context`.

## Prerequisites

- Node.js 18+
- npm 10+
- A running relay server (see [Running the Relay](#running-the-relay))

## Setup

```bash
# Clone and install
git clone https://github.com/rameez-j/quorum.git
cd quorum
npm install

# Build all packages
npm run build
```

## Running the Relay

The relay server must be running for hosts and members to connect. By default it listens on port 7777.

```bash
# From the repo root
node packages/relay/dist/index.js

# Or with a custom port
PORT=8888 node packages/relay/dist/index.js
```

For production, a Dockerfile is included:

```bash
cd packages/relay
docker build -t quorum-relay .
docker run -p 7777:7777 quorum-relay
```

## Usage

### Starting a session (host)

```bash
npx quorum start --name "Alice"
```

Output:
```
Starting Quorum session...
✓ Session created: a1b2c3

Share with your team: quorum join a1b2c3

Waiting for members...
```

The host's machine runs the MCP server and stores context in a `.collab/` directory in the current working directory.

### Joining a session (teammate)

```bash
npx quorum join a1b2c3 --name "Bob"
```

Output:
```
Joining session a1b2c3...
✓ Connected to session a1b2c3
✓ MCP tools available
```

The teammate's machine runs a local MCP proxy. All tool calls are forwarded through the relay to the host.

### Exporting context

```bash
npx quorum export
```

Generates `.collab/context.md` — a human-readable summary of all decisions, interfaces, dependencies, and conflicts from the session.

### Checking status

```bash
npx quorum status
```

### Custom relay URL

By default, the CLI connects to `ws://localhost:7777`. Override with:

```bash
export QUORUM_RELAY_URL=ws://your-relay-host:7777
```

## Project Structure

```
quorum/
├── packages/
│   ├── shared/     # @quorum/shared — types, protocol definitions, ID generation
│   ├── server/     # @quorum/server — MCP server, context store, tool dispatcher
│   ├── relay/      # @quorum/relay  — stateless WebSocket relay server
│   └── cli/        # quorum         — CLI commands, MCP proxy, context export
├── turbo.json
├── package.json
└── tsconfig.base.json
```

Build order (managed by Turborepo): `shared` → `server` → `relay` / `cli`

### Package Details

**`@quorum/shared`** — Types and protocol definitions shared across all packages. Defines `Decision`, `Dependency`, `Interface`, `Conflict`, `Member`, and all WebSocket message types.

**`@quorum/server`** — The MCP server that registers all 9 tools, plus a `ContextStore` that persists session data to JSON files. Also exports a `createToolDispatcher` for executing tool calls directly (used by the host to handle relay-forwarded requests without going through MCP protocol).

**`@quorum/relay`** — A stateless WebSocket server that groups connections by session ID and forwards messages between them. Stores no data.

**`quorum` (CLI)** — The user-facing package with `start`, `join`, `status`, and `export` commands. Includes the MCP proxy that teammates run locally.

## Development

```bash
# Build all packages
npm run build

# Run all tests
npm test

# Build and test in watch mode
npm run dev
```

### Tests

```bash
# Run all tests
npm test

# Run tests for a specific package
npx vitest run --project server
npx vitest run --project shared
npx vitest run --project relay
npx vitest run --project cli
```

## How Tool Calls Flow

```
1. Teammate's Claude Code calls a tool (e.g., post_decision)
2. Local MCP proxy receives the call
3. Proxy sends a tool_request message over WebSocket to the relay
4. Relay forwards the message to the host
5. Host's tool dispatcher executes the tool, writing to the JSON store
6. Host sends a tool_response back through the relay
7. Relay forwards the response to the teammate's proxy
8. Proxy returns the result to Claude Code
```

Concurrent tool calls from multiple teammates are supported via `requestId` correlation.

## Context Export Format

When you run `quorum export`, it generates a markdown file like:

```markdown
# Project Context — Session a1b2c3
Generated: 2026-03-04T14:30:00Z

## Team
- Alice (host)
- Bob

## Decisions
### #1: Use JWT for authentication (Alice)
- **Rationale:** Stateless, scales horizontally
- **Tags:** auth, security

## Interfaces
### User API (User Service <-> Auth Service)
- **Status:** agreed
- **Spec:** GET /users/:id returns { id, email, role }

## Dependencies
### Auth -> User Service: needs user lookup endpoint
- **Priority:** blocking
- **Status:** resolved
- **Resolution:** Agreed on GET /users/:id
```

## License

ISC
