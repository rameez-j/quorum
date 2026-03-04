# Quorum

MCP-based shared context server for keeping team members' AI agents in sync.

## Repository Structure

Monorepo with 4 packages managed by turborepo:
- `packages/shared` — Types, protocol messages, utilities
- `packages/server` — MCP server + ContextStore (JSON file persistence)
- `packages/relay` — WebSocket relay server (hosted infrastructure)
- `packages/cli` — CLI entry point (`quorum start/join/stop/status/export`)

## Commands

- `npm run build` — Build all packages (order: shared → server → relay/cli)
- `npm run test` — Run all tests
- `npm run dev` — Watch mode for all packages

## Architecture

- Host runs MCP server locally with ContextStore backed by JSON files in `.collab/`
- Teammates connect via WebSocket relay, run local MCP proxy
- 9 MCP tools: get_context, post_decision, flag_dependency, get_dependencies, sync, post_interface, resolve_dependency, raise_conflict, resolve_conflict

## Testing

Tests use vitest. Run per-package: `cd packages/<name> && npx vitest run`

Note: Relay and integration tests require network access (WebSocket servers). If running in a sandboxed environment, these tests may need the sandbox disabled.
