# Quorum

MCP-based shared context server for keeping team members' AI agents in sync. Quorum lets multiple developers' Claude Code instances share decisions, interfaces, dependencies, and conflicts in real time.

## How It Works

Quorum runs as an MCP server inside Claude Code. When you start or join a session, your Claude Code instance connects to a shared relay, and all participants can read and write to a shared context store through natural conversation.

```
Claude Code (You)                     Claude Code (Teammate)
      |                                      |
      v                                      v
quorum serve (MCP stdio)             quorum serve (MCP stdio)
      |                                      |
      +--- WebSocket ----> Relay <--- WebSocket ---+
                             |
                     (routes messages
                      between host
                      and members)
```

The host's instance holds the canonical context store (`.collab/` directory). Members' tool calls are forwarded through the relay to the host and back.

## Setup

### 1. Install

```bash
npm install -g quorum
```

### 2. Register with Claude Code

```bash
quorum install            # Global (all projects)
quorum install --project  # Project-level only
```

This adds Quorum to your Claude Code MCP settings. To remove it later:

```bash
quorum uninstall            # Global
quorum uninstall --project  # Project-level
```

### 3. Restart Claude Code

After registering, restart Claude Code so it picks up the new MCP server. Quorum tools will now be available in every conversation.

## Usage

All interaction happens through Claude Code -- no separate terminals needed.

### Start a session (host)

Tell Claude Code:

> "Start a quorum session"

Claude calls `quorum_start` with your name, creates a session, and returns a session ID. Share this ID with your teammates.

### Join a session (member)

Tell Claude Code:

> "Join quorum session abc123"

Claude calls `quorum_join` with the session ID and your name. You are now connected to the host's context store.

### Collaborate

Once in a session, all 9 context tools are available. You can ask Claude to:

- **Record a decision:** "Post a decision that we're using PostgreSQL for the database"
- **Define an interface:** "Define the API contract between the auth service and the gateway"
- **Flag a dependency:** "Flag that my payment module depends on Alice's user service"
- **Check context:** "Show me all current decisions and interfaces"
- **Sync up:** "Give me a full sync of the session state"
- **Raise a conflict:** "These two decisions about the API format contradict each other"
- **Resolve things:** "Resolve that dependency -- Alice shipped the user service"

### End a session

> "Stop the quorum session"

Claude calls `quorum_stop`, disconnects from the relay, and returns to idle. The context data remains in `.collab/` on the host's machine.

### Export context

```bash
quorum export
```

Exports the session context to `.collab/context.md` as a readable markdown file.

## MCP Tools

Quorum exposes 13 MCP tools to Claude Code:

### Session management (4 tools)

| Tool | Description |
|------|-------------|
| `quorum_start` | Start a new session as host |
| `quorum_join` | Join an existing session as member |
| `quorum_status` | Check current session status |
| `quorum_stop` | End the current session |

### Context operations (9 tools)

| Tool | Description |
|------|-------------|
| `get_context` | Get shared context (decisions, interfaces, dependencies) |
| `post_decision` | Record an architecture or design decision |
| `flag_dependency` | Declare a dependency on another member's work |
| `get_dependencies` | View all dependencies and their status |
| `sync` | Get a full snapshot of session state |
| `post_interface` | Define an API contract between components |
| `resolve_dependency` | Mark a dependency as resolved |
| `raise_conflict` | Flag conflicting decisions or interfaces |
| `resolve_conflict` | Resolve a conflict |

Context tools return an error when no session is active and prompt the user to start or join one first.

## Project Structure

```
packages/
  shared/       Types, protocol messages, utilities
  server/       ContextStore + tool dispatcher (JSON file persistence)
  relay/        WebSocket relay server (hosted infrastructure)
  cli/
    src/
      index.ts                  CLI entry point (install/uninstall/serve/export)
      config.ts                 Claude Code settings management
      commands/
        serve.ts                Stateful MCP server with session state machine
        export-context.ts       Export context to markdown
```

## Relay Server

The relay routes WebSocket messages between hosts and members. It is deployed as infrastructure and users do not need to run it themselves.

For development, start the relay locally:

```bash
cd packages/relay
npx tsx src/index.ts
```

The relay listens on port 7777 by default. Set `QUORUM_RELAY_URL` to point to a different relay.

## Development

```bash
npm install
npm run build    # Build all packages
npm run test     # Run all tests
npm run dev      # Watch mode
```

Tests use vitest. Run per-package:

```bash
cd packages/<name> && npx vitest run
```

## License

MIT
