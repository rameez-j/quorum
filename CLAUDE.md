# Quorum

MCP-based shared context server for keeping team members' AI agents in sync.

## Repository Structure

Monorepo with 4 packages managed by turborepo:
- `packages/shared` — Types, protocol messages, utilities
- `packages/server` — MCP server + ContextStore (JSON file persistence)
- `packages/relay` — WebSocket relay server (hosted infrastructure)
- `packages/cli` — CLI entry point (`quorum install/uninstall/serve/export`) and stateful MCP server with 13 tools

## Commands

- `npm run build` — Build all packages (order: shared -> server -> relay/cli)
- `npm run test` — Run all tests
- `npm run dev` — Watch mode for all packages

## Architecture

- Claude Code spawns `quorum serve` as an MCP server via stdio
- The serve process is a stateful MCP server with 13 tools (4 session + 9 context)
- Session tools (`quorum_start`, `quorum_join`, `quorum_status`, `quorum_stop`) manage lifecycle
- Context tools (`get_context`, `post_decision`, `flag_dependency`, `get_dependencies`, `sync`, `post_interface`, `resolve_dependency`, `raise_conflict`, `resolve_conflict`) operate on shared state
- Host creates a ContextStore backed by JSON files in `.collab/` and connects to the relay
- Members connect to the relay and forward tool calls through WebSocket to the host
- Users interact entirely through MCP tools inside Claude Code -- no separate terminals needed

## Testing

Tests use vitest. Run per-package: `cd packages/<name> && npx vitest run`

Note: Relay and integration tests require network access (WebSocket servers). If running in a sandboxed environment, these tests may need the sandbox disabled.
