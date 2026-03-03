# Quorum Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Quorum — an MCP-based shared context server that keeps team members' AI agents in sync during collaborative projects.

**Architecture:** Monorepo with 4 packages: `@quorum/shared` (types/protocol), `@quorum/server` (MCP server + context store), `@quorum/relay` (WebSocket relay), and `quorum` (CLI). Host runs the MCP server locally; teammates connect via a local MCP proxy that forwards tool calls through a hosted WebSocket relay. JSON file storage on host.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `ws`, `commander`, `turborepo`, `vitest`, `zod`

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`
- Create: `packages/relay/package.json`
- Create: `packages/relay/tsconfig.json`
- Create: `packages/relay/src/index.ts`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`
- Create: `.gitignore`

**Step 1: Create root package.json**

```json
{
  "private": true,
  "name": "quorum-monorepo",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5"
  },
  "packageManager": "npm@10.0.0",
  "workspaces": [
    "packages/*"
  ]
}
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "es2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Step 4: Create @quorum/shared package**

`packages/shared/package.json`:
```json
{
  "name": "@quorum/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/shared/src/index.ts`:
```typescript
export {};
```

**Step 5: Create @quorum/server package**

`packages/server/package.json`:
```json
{
  "name": "@quorum/server",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@quorum/shared": "*",
    "@modelcontextprotocol/sdk": "^1",
    "zod": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

`packages/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/server/src/index.ts`:
```typescript
export {};
```

**Step 6: Create @quorum/relay package**

`packages/relay/package.json`:
```json
{
  "name": "@quorum/relay",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@quorum/shared": "*",
    "ws": "^8"
  },
  "devDependencies": {
    "@types/ws": "^8",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

`packages/relay/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/relay/src/index.ts`:
```typescript
export {};
```

**Step 7: Create quorum CLI package**

`packages/cli/package.json`:
```json
{
  "name": "quorum",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "quorum": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@quorum/shared": "*",
    "@quorum/server": "*",
    "@modelcontextprotocol/sdk": "^1",
    "commander": "^13",
    "ws": "^8",
    "zod": "^3"
  },
  "devDependencies": {
    "@types/ws": "^8",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env node
console.log('quorum');
```

**Step 8: Create .gitignore**

```
node_modules/
dist/
.collab/
*.tsbuildinfo
```

**Step 9: Install dependencies and verify build**

Run: `npm install && npm run build`
Expected: All 4 packages compile successfully with no errors.

**Step 10: Commit**

```bash
git add .
git commit -m "feat: scaffold monorepo with 4 packages

Set up turborepo workspace with @quorum/shared, @quorum/server,
@quorum/relay, and quorum (CLI) packages."
```

---

### Task 2: Shared Types & Protocol (@quorum/shared)

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/protocol.ts`
- Create: `packages/shared/src/id.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/__tests__/id.test.ts`

**Step 1: Write the failing test for ID generation**

`packages/shared/src/__tests__/id.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateId } from '../id.js';

describe('generateId', () => {
  it('returns a 6-character string', () => {
    const id = generateId();
    expect(id).toHaveLength(6);
  });

  it('returns unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/__tests__/id.test.ts`
Expected: FAIL — cannot find module `../id.js`

**Step 3: Implement ID generation**

`packages/shared/src/id.ts`:
```typescript
import { randomBytes } from 'node:crypto';

export function generateId(): string {
  return randomBytes(3).toString('hex');
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/__tests__/id.test.ts`
Expected: PASS

**Step 5: Write domain types**

`packages/shared/src/types.ts`:
```typescript
export interface Decision {
  id: string;
  title: string;
  description: string;
  rationale: string;
  author: string;
  timestamp: string;
  tags: string[];
  supersededBy?: string;
}

export interface Dependency {
  id: string;
  from: string;
  to: string;
  description: string;
  priority: 'blocking' | 'nice-to-have';
  status: 'open' | 'resolved';
  resolution?: string;
  timestamp: string;
}

export interface Interface {
  id: string;
  name: string;
  between: [string, string];
  specification: string;
  author: string;
  status: 'proposed' | 'agreed';
  timestamp: string;
}

export interface Conflict {
  id: string;
  itemIds: [string, string];
  description: string;
  author: string;
  status: 'open' | 'resolved';
  resolution?: string;
  supersedes?: string;
  timestamp: string;
}

export interface Member {
  id: string;
  name: string;
  connectedAt: string;
}

export interface SessionContext {
  brief: string;
  decisions: Decision[];
  dependencies: Dependency[];
  interfaces: Interface[];
  conflicts: Conflict[];
  members: Member[];
}
```

**Step 6: Write protocol message types**

`packages/shared/src/protocol.ts`:
```typescript
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
```

**Step 7: Update index.ts to export everything**

`packages/shared/src/index.ts`:
```typescript
export * from './types.js';
export * from './protocol.js';
export { generateId } from './id.js';
```

**Step 8: Build and run tests**

Run: `cd packages/shared && npm run build && npx vitest run`
Expected: Build succeeds, all tests pass.

**Step 9: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types, protocol messages, and ID generation"
```

---

### Task 3: Context Store (@quorum/server)

**Files:**
- Create: `packages/server/src/store/context-store.ts`
- Create: `packages/server/src/__tests__/context-store.test.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Write failing tests for ContextStore**

`packages/server/src/__tests__/context-store.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextStore } from '../store/context-store.js';

describe('ContextStore', () => {
  let store: ContextStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-test-'));
    store = new ContextStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  describe('decisions', () => {
    it('adds and retrieves a decision', async () => {
      const result = await store.addDecision({
        title: 'Use JWT',
        description: 'Use JWT for auth',
        rationale: 'Stateless and scalable',
        author: 'alice',
        tags: ['auth'],
      });

      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();

      const decisions = await store.getDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.title).toBe('Use JWT');
    });
  });

  describe('dependencies', () => {
    it('adds and retrieves a dependency', async () => {
      const result = await store.addDependency({
        from: 'alice',
        to: 'bob',
        description: 'Need user lookup endpoint',
        priority: 'blocking',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('open');

      const deps = await store.getDependencies();
      expect(deps).toHaveLength(1);
    });

    it('resolves a dependency', async () => {
      const { id } = await store.addDependency({
        from: 'alice',
        to: 'bob',
        description: 'Need user lookup endpoint',
        priority: 'blocking',
      });

      const resolved = await store.resolveDependency(id, 'Agreed on GET /users/:id');
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution).toBe('Agreed on GET /users/:id');
    });
  });

  describe('interfaces', () => {
    it('adds and retrieves an interface', async () => {
      const result = await store.addInterface({
        name: 'User API',
        between: ['auth-service', 'user-service'],
        specification: 'GET /users/:id returns { id, email, role }',
        author: 'alice',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('proposed');

      const interfaces = await store.getInterfaces();
      expect(interfaces).toHaveLength(1);
    });
  });

  describe('conflicts', () => {
    it('raises and resolves a conflict', async () => {
      const d1 = await store.addDecision({
        title: 'Use REST', description: '', rationale: '', author: 'alice', tags: [],
      });
      const d2 = await store.addDecision({
        title: 'Use GraphQL', description: '', rationale: '', author: 'bob', tags: [],
      });

      const conflict = await store.raiseConflict({
        itemIds: [d1.id, d2.id],
        description: 'REST vs GraphQL',
        author: 'bob',
      });

      expect(conflict.status).toBe('open');

      const resolved = await store.resolveConflict(
        conflict.id,
        'GraphQL chosen',
        d1.id
      );
      expect(resolved.status).toBe('resolved');

      // Superseded decision should be marked
      const decisions = await store.getDecisions();
      const superseded = decisions.find(d => d.id === d1.id);
      expect(superseded!.supersededBy).toBe(d2.id);
    });
  });

  describe('context', () => {
    it('returns full context', async () => {
      await store.addDecision({
        title: 'Use JWT', description: '', rationale: '', author: 'alice', tags: [],
      });

      const context = await store.getContext();
      expect(context.decisions).toHaveLength(1);
      expect(context.dependencies).toHaveLength(0);
      expect(context.interfaces).toHaveLength(0);
      expect(context.conflicts).toHaveLength(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/context-store.test.ts`
Expected: FAIL — cannot find module `../store/context-store.js`

**Step 3: Implement ContextStore**

`packages/server/src/store/context-store.ts`:
```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Decision,
  type Dependency,
  type Interface,
  type Conflict,
  type SessionContext,
  generateId,
} from '@quorum/shared';

interface StoreData {
  brief: string;
  decisions: Decision[];
  dependencies: Dependency[];
  interfaces: Interface[];
  conflicts: Conflict[];
}

export class ContextStore {
  private dataPath: string;

  constructor(private storeDir: string) {
    this.dataPath = join(storeDir, 'context.json');
  }

  private async read(): Promise<StoreData> {
    try {
      const raw = await readFile(this.dataPath, 'utf-8');
      return JSON.parse(raw) as StoreData;
    } catch {
      return {
        brief: '',
        decisions: [],
        dependencies: [],
        interfaces: [],
        conflicts: [],
      };
    }
  }

  private async write(data: StoreData): Promise<void> {
    await mkdir(this.storeDir, { recursive: true });
    await writeFile(this.dataPath, JSON.stringify(data, null, 2));
  }

  async setBrief(brief: string): Promise<void> {
    const data = await this.read();
    data.brief = brief;
    await this.write(data);
  }

  async addDecision(input: {
    title: string;
    description: string;
    rationale: string;
    author: string;
    tags: string[];
  }): Promise<Decision> {
    const data = await this.read();
    const decision: Decision = {
      id: generateId(),
      ...input,
      timestamp: new Date().toISOString(),
    };
    data.decisions.push(decision);
    await this.write(data);
    return decision;
  }

  async getDecisions(): Promise<Decision[]> {
    const data = await this.read();
    return data.decisions;
  }

  async addDependency(input: {
    from: string;
    to: string;
    description: string;
    priority: 'blocking' | 'nice-to-have';
  }): Promise<Dependency> {
    const data = await this.read();
    const dependency: Dependency = {
      id: generateId(),
      ...input,
      status: 'open',
      timestamp: new Date().toISOString(),
    };
    data.dependencies.push(dependency);
    await this.write(data);
    return dependency;
  }

  async getDependencies(filter?: {
    member?: string;
    status?: 'open' | 'resolved';
  }): Promise<Dependency[]> {
    const data = await this.read();
    let deps = data.dependencies;
    if (filter?.member) {
      deps = deps.filter(d => d.from === filter.member || d.to === filter.member);
    }
    if (filter?.status) {
      deps = deps.filter(d => d.status === filter.status);
    }
    return deps;
  }

  async resolveDependency(id: string, resolution: string): Promise<Dependency> {
    const data = await this.read();
    const dep = data.dependencies.find(d => d.id === id);
    if (!dep) throw new Error(`Dependency ${id} not found`);
    dep.status = 'resolved';
    dep.resolution = resolution;
    await this.write(data);
    return dep;
  }

  async addInterface(input: {
    name: string;
    between: [string, string];
    specification: string;
    author: string;
  }): Promise<Interface> {
    const data = await this.read();
    const iface: Interface = {
      id: generateId(),
      ...input,
      status: 'proposed',
      timestamp: new Date().toISOString(),
    };
    data.interfaces.push(iface);
    await this.write(data);
    return iface;
  }

  async getInterfaces(): Promise<Interface[]> {
    const data = await this.read();
    return data.interfaces;
  }

  async raiseConflict(input: {
    itemIds: [string, string];
    description: string;
    author: string;
  }): Promise<Conflict> {
    const data = await this.read();
    const conflict: Conflict = {
      id: generateId(),
      ...input,
      status: 'open',
      timestamp: new Date().toISOString(),
    };
    data.conflicts.push(conflict);
    await this.write(data);
    return conflict;
  }

  async resolveConflict(
    conflictId: string,
    resolution: string,
    supersedes?: string
  ): Promise<Conflict> {
    const data = await this.read();
    const conflict = data.conflicts.find(c => c.id === conflictId);
    if (!conflict) throw new Error(`Conflict ${conflictId} not found`);
    conflict.status = 'resolved';
    conflict.resolution = resolution;

    if (supersedes) {
      conflict.supersedes = supersedes;
      const decision = data.decisions.find(d => d.id === supersedes);
      if (decision) {
        // Mark superseded decision, point to the other decision
        const otherId = conflict.itemIds.find(id => id !== supersedes);
        if (otherId) decision.supersededBy = otherId;
      }
    }

    await this.write(data);
    return conflict;
  }

  async getContext(): Promise<SessionContext> {
    const data = await this.read();
    return {
      ...data,
      members: [],
    };
  }

  async getData(): Promise<StoreData> {
    return this.read();
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/__tests__/context-store.test.ts`
Expected: All tests PASS

**Step 5: Update server index.ts**

`packages/server/src/index.ts`:
```typescript
export { ContextStore } from './store/context-store.js';
```

**Step 6: Commit**

```bash
git add packages/server/
git commit -m "feat: implement ContextStore with JSON file persistence

Handles decisions, dependencies, interfaces, and conflicts
with full CRUD operations and conflict resolution."
```

---

### Task 4: MCP Server with Tools (@quorum/server)

**Files:**
- Create: `packages/server/src/mcp/tools.ts`
- Create: `packages/server/src/mcp/server.ts`
- Create: `packages/server/src/__tests__/mcp-server.test.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Write failing test for MCP server tool execution**

`packages/server/src/__tests__/mcp-server.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQuorumServer } from '../mcp/server.js';

describe('Quorum MCP Server', () => {
  let client: Client;
  let tempDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-mcp-test-'));
    const { server } = createQuorumServer(tempDir);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterEach(async () => {
    await cleanup();
    await rm(tempDir, { recursive: true });
  });

  it('lists all 9 tools', async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map(t => t.name).sort();
    expect(toolNames).toEqual([
      'flag_dependency',
      'get_context',
      'get_dependencies',
      'post_decision',
      'post_interface',
      'raise_conflict',
      'resolve_conflict',
      'resolve_dependency',
      'sync',
    ]);
  });

  it('posts and retrieves a decision via tools', async () => {
    const postResult = await client.callTool({
      name: 'post_decision',
      arguments: {
        title: 'Use JWT',
        description: 'JWT for authentication',
        rationale: 'Stateless',
        author: 'alice',
        tags: ['auth'],
      },
    });

    expect(postResult.content).toBeDefined();
    const postData = JSON.parse(
      (postResult.content as Array<{ type: string; text: string }>)[0]!.text
    );
    expect(postData.id).toBeDefined();

    const getResult = await client.callTool({
      name: 'get_context',
      arguments: {},
    });
    const contextData = JSON.parse(
      (getResult.content as Array<{ type: string; text: string }>)[0]!.text
    );
    expect(contextData.decisions).toHaveLength(1);
    expect(contextData.decisions[0].title).toBe('Use JWT');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/mcp-server.test.ts`
Expected: FAIL — cannot find module `../mcp/server.js`

**Step 3: Implement MCP server with all 9 tools**

`packages/server/src/mcp/server.ts`:
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ContextStore } from '../store/context-store.js';
import type { Member } from '@quorum/shared';

export function createQuorumServer(storeDir: string) {
  const store = new ContextStore(storeDir);
  let members: Member[] = [];

  const server = new McpServer({
    name: 'quorum',
    version: '0.1.0',
  });

  function jsonResponse(data: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
  }

  // 1. get_context
  server.tool(
    'get_context',
    'Get shared project context including decisions, interfaces, and dependencies',
    {
      filter: z.enum(['decisions', 'interfaces', 'dependencies', 'all']).optional(),
    },
    async ({ filter }) => {
      const context = await store.getContext();
      context.members = members;

      if (filter && filter !== 'all') {
        return jsonResponse({
          [filter]: context[filter],
          members: context.members,
        });
      }
      return jsonResponse(context);
    }
  );

  // 2. post_decision
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
      const decision = await store.addDecision({
        title, description, rationale, author, tags: tags ?? [],
      });
      return jsonResponse({ id: decision.id, timestamp: decision.timestamp });
    }
  );

  // 3. flag_dependency
  server.tool(
    'flag_dependency',
    'Declare a dependency on another team member\'s work',
    {
      from: z.string(),
      to: z.string(),
      description: z.string(),
      priority: z.enum(['blocking', 'nice-to-have']),
    },
    async ({ from, to, description, priority }) => {
      const dep = await store.addDependency({ from, to, description, priority });
      return jsonResponse({ id: dep.id, status: dep.status });
    }
  );

  // 4. get_dependencies
  server.tool(
    'get_dependencies',
    'View all declared dependencies and their resolution status',
    {
      member: z.string().optional(),
      status: z.enum(['open', 'resolved']).optional(),
    },
    async ({ member, status }) => {
      const deps = await store.getDependencies({ member, status });
      return jsonResponse({ dependencies: deps });
    }
  );

  // 5. sync
  server.tool(
    'sync',
    'Get a full snapshot of the current session state and all members',
    {},
    async () => {
      const context = await store.getContext();
      return jsonResponse({
        members,
        recentDecisions: context.decisions.slice(-10),
        openDependencies: context.dependencies.filter(d => d.status === 'open'),
        unresolvedInterfaces: context.interfaces.filter(i => i.status === 'proposed'),
        openConflicts: context.conflicts.filter(c => c.status === 'open'),
      });
    }
  );

  // 6. post_interface
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
      const iface = await store.addInterface({ name, between, specification, author });
      return jsonResponse({ id: iface.id, status: iface.status });
    }
  );

  // 7. resolve_dependency
  server.tool(
    'resolve_dependency',
    'Mark a flagged dependency as resolved with a resolution description',
    {
      dependencyId: z.string(),
      resolution: z.string(),
    },
    async ({ dependencyId, resolution }) => {
      const dep = await store.resolveDependency(dependencyId, resolution);
      return jsonResponse({ id: dep.id, status: dep.status });
    }
  );

  // 8. raise_conflict
  server.tool(
    'raise_conflict',
    'Flag that two decisions or interfaces are in conflict and need resolution',
    {
      itemIds: z.tuple([z.string(), z.string()]),
      description: z.string(),
      author: z.string(),
    },
    async ({ itemIds, description, author }) => {
      const conflict = await store.raiseConflict({ itemIds, description, author });
      return jsonResponse({ id: conflict.id, status: conflict.status });
    }
  );

  // 9. resolve_conflict
  server.tool(
    'resolve_conflict',
    'Resolve a conflict, optionally superseding one of the conflicting decisions',
    {
      conflictId: z.string(),
      resolution: z.string(),
      supersedes: z.string().optional(),
    },
    async ({ conflictId, resolution, supersedes }) => {
      const conflict = await store.resolveConflict(conflictId, resolution, supersedes);
      return jsonResponse({ id: conflict.id, status: conflict.status });
    }
  );

  return {
    server,
    store,
    setMembers(m: Member[]) {
      members = m;
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run`
Expected: All tests PASS

**Step 5: Update server index.ts**

`packages/server/src/index.ts`:
```typescript
export { ContextStore } from './store/context-store.js';
export { createQuorumServer } from './mcp/server.js';
```

**Step 6: Commit**

```bash
git add packages/server/
git commit -m "feat: implement MCP server with all 9 tools

Tools: get_context, post_decision, flag_dependency, get_dependencies,
sync, post_interface, resolve_dependency, raise_conflict, resolve_conflict"
```

---

### Task 5: WebSocket Relay (@quorum/relay)

**Files:**
- Create: `packages/relay/src/relay.ts`
- Create: `packages/relay/src/__tests__/relay.test.ts`
- Modify: `packages/relay/src/index.ts`

**Step 1: Write failing test for relay**

`packages/relay/src/__tests__/relay.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createRelay } from '../relay.js';
import type { ClientMessage, RelayMessage } from '@quorum/shared';

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<RelayMessage> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()) as RelayMessage);
    });
  });
}

function send(ws: WebSocket, msg: ClientMessage): void {
  ws.send(JSON.stringify(msg));
}

describe('Relay', () => {
  let relay: ReturnType<typeof createRelay>;
  const PORT = 9877;

  beforeEach(async () => {
    relay = createRelay(PORT);
    await relay.start();
  });

  afterEach(async () => {
    await relay.stop();
  });

  it('creates a session and returns session ID', async () => {
    const host = await connectClient(PORT);
    const responsePromise = waitForMessage(host);

    send(host, { type: 'create_session', payload: { hostId: 'host-1', name: 'Alice' } });

    const response = await responsePromise;
    expect(response.type).toBe('session_created');
    expect(response.payload).toHaveProperty('sessionId');

    host.close();
  });

  it('allows a member to join and notifies the host', async () => {
    const host = await connectClient(PORT);
    const createPromise = waitForMessage(host);
    send(host, { type: 'create_session', payload: { hostId: 'host-1', name: 'Alice' } });
    const { payload } = await createPromise;
    const sessionId = (payload as { sessionId: string }).sessionId;

    const joinNotification = waitForMessage(host);

    const member = await connectClient(PORT);
    const memberResponse = waitForMessage(member);
    send(member, {
      type: 'join_session',
      payload: { sessionId, memberId: 'member-1', name: 'Bob' },
    });

    const notification = await joinNotification;
    expect(notification.type).toBe('member_joined');

    const ack = await memberResponse;
    expect(ack.type).toBe('member_joined');

    host.close();
    member.close();
  });

  it('forwards tool_request from member to host and tool_response back', async () => {
    // Host creates session
    const host = await connectClient(PORT);
    const createPromise = waitForMessage(host);
    send(host, { type: 'create_session', payload: { hostId: 'host-1', name: 'Alice' } });
    const { payload } = await createPromise;
    const sessionId = (payload as { sessionId: string }).sessionId;

    // Member joins
    const member = await connectClient(PORT);
    waitForMessage(host); // consume member_joined on host
    const memberAck = waitForMessage(member);
    send(member, {
      type: 'join_session',
      payload: { sessionId, memberId: 'member-1', name: 'Bob' },
    });
    await memberAck;

    // Member sends tool_request
    const hostReceives = waitForMessage(host);
    send(member, {
      type: 'tool_request',
      payload: { requestId: 'req-1', tool: 'get_context', args: {} },
    });

    const forwarded = await hostReceives;
    expect(forwarded.type).toBe('tool_request');
    expect(forwarded.payload).toEqual({
      requestId: 'req-1',
      tool: 'get_context',
      args: {},
    });

    // Host sends tool_response
    const memberReceives = waitForMessage(member);
    send(host, {
      type: 'tool_response',
      payload: { requestId: 'req-1', result: { decisions: [] } },
    });

    const response = await memberReceives;
    expect(response.type).toBe('tool_response');

    host.close();
    member.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/relay && npx vitest run src/__tests__/relay.test.ts`
Expected: FAIL — cannot find module `../relay.js`

**Step 3: Implement relay**

`packages/relay/src/relay.ts`:
```typescript
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
  // Map from WebSocket to session ID for routing tool_responses
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

        // Notify everyone including the joiner
        broadcast(session, {
          type: 'member_joined',
          payload: { memberId: msg.payload.memberId, name: msg.payload.name },
        });
        break;
      }

      case 'tool_request': {
        // Forward to host
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
        // Forward to all members (the requesting member will match on requestId)
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
              // Host disconnected — notify members
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
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npm run build && cd ../relay && npx vitest run`
Expected: All tests PASS

**Step 5: Update relay index.ts**

`packages/relay/src/index.ts`:
```typescript
import { createRelay } from './relay.js';

const PORT = parseInt(process.env['PORT'] ?? '7777', 10);
const relay = createRelay(PORT);

relay.start().then(() => {
  console.log(`Quorum relay listening on port ${PORT}`);
});

export { createRelay } from './relay.js';
```

**Step 6: Commit**

```bash
git add packages/relay/
git commit -m "feat: implement WebSocket relay with room-based message forwarding

Handles session creation, member joining, and tool request/response
routing between members and host."
```

---

### Task 6: MCP Proxy (packages/cli)

**Files:**
- Create: `packages/cli/src/proxy/mcp-proxy.ts`
- Create: `packages/cli/src/__tests__/mcp-proxy.test.ts`

**Step 1: Write failing test for MCP proxy**

This test verifies the proxy can receive an MCP tool call, forward it through a WebSocket connection, and return the response.

`packages/cli/src/__tests__/mcp-proxy.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpProxy } from '../proxy/mcp-proxy.js';

describe('MCP Proxy', () => {
  it('lists the same tools the host provides', async () => {
    // Simulate a host tool handler
    const hostTools = [
      { name: 'get_context', description: 'Get context', inputSchema: { type: 'object' as const, properties: {} } },
      { name: 'post_decision', description: 'Post decision', inputSchema: { type: 'object' as const, properties: {} } },
    ];

    const toolHandler = async (name: string, args: Record<string, unknown>) => {
      return { decisions: [] };
    };

    const { server, setTools } = createMcpProxy(toolHandler);
    setTools(hostTools);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(['get_context', 'post_decision']);

    await client.close();
    await server.close();
  });

  it('forwards tool calls through the handler', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

    const toolHandler = async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { decisions: [{ id: '1', title: 'Test' }] };
    };

    const { server, setTools } = createMcpProxy(toolHandler);
    setTools([
      { name: 'get_context', description: 'Get context', inputSchema: { type: 'object' as const, properties: {} } },
    ]);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'get_context', arguments: {} });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.name).toBe('get_context');

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0]!.text
    );
    expect(data.decisions).toHaveLength(1);

    await client.close();
    await server.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/__tests__/mcp-proxy.test.ts`
Expected: FAIL — cannot find module `../proxy/mcp-proxy.js`

**Step 3: Implement MCP proxy**

`packages/cli/src/proxy/mcp-proxy.ts`:
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown> };
}

type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export function createMcpProxy(handler: ToolHandler) {
  const server = new McpServer({
    name: 'quorum-proxy',
    version: '0.1.0',
  });

  function setTools(tools: ToolDefinition[]) {
    for (const tool of tools) {
      // Register each tool with a passthrough handler
      server.tool(
        tool.name,
        tool.description,
        {},
        async (args) => {
          const result = await handler(tool.name, args as Record<string, unknown>);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          };
        }
      );
    }
  }

  return { server, setTools };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npm run build && cd ../server && npm run build && cd ../cli && npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/cli/
git commit -m "feat: implement MCP proxy that forwards tool calls to host"
```

---

### Task 7: CLI Commands

**Files:**
- Create: `packages/cli/src/commands/start.ts`
- Create: `packages/cli/src/commands/join.ts`
- Create: `packages/cli/src/commands/stop.ts`
- Create: `packages/cli/src/commands/status.ts`
- Create: `packages/cli/src/commands/export-context.ts`
- Create: `packages/cli/src/config.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create config utility for managing MCP server registration**

`packages/cli/src/config.ts`:
```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const MCP_SERVER_NAME = 'quorum';

interface ClaudeSettings {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
  [key: string]: unknown;
}

export async function registerMcpServer(proxyPort: number): Promise<void> {
  let settings: ClaudeSettings = {};
  try {
    const raw = await readFile(CLAUDE_SETTINGS_PATH, 'utf-8');
    settings = JSON.parse(raw) as ClaudeSettings;
  } catch {
    // File doesn't exist yet
  }

  settings.mcpServers ??= {};
  settings.mcpServers[MCP_SERVER_NAME] = {
    command: 'npx',
    args: ['-y', 'quorum', '_mcp-proxy', String(proxyPort)],
  };

  await mkdir(dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
  await writeFile(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function unregisterMcpServer(): Promise<void> {
  try {
    const raw = await readFile(CLAUDE_SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(raw) as ClaudeSettings;
    if (settings.mcpServers) {
      delete settings.mcpServers[MCP_SERVER_NAME];
    }
    await writeFile(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch {
    // File doesn't exist, nothing to clean up
  }
}

export const RELAY_URL = process.env['QUORUM_RELAY_URL'] ?? 'ws://localhost:7777';
```

**Step 2: Create the `start` command**

`packages/cli/src/commands/start.ts`:
```typescript
import WebSocket from 'ws';
import { createQuorumServer } from '@quorum/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RELAY_URL } from '../config.js';
import type { ClientMessage, RelayMessage, Member } from '@quorum/shared';
import { generateId } from '@quorum/shared';
import { join } from 'node:path';

export async function startCommand(options: { name: string }) {
  const storeDir = join(process.cwd(), '.collab');
  const { server, store, setMembers } = createQuorumServer(storeDir);
  const members: Member[] = [];
  const hostId = generateId();

  console.log('Starting Quorum session...');

  // Connect to relay
  const ws = new WebSocket(RELAY_URL);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      const msg: ClientMessage = {
        type: 'create_session',
        payload: { hostId, name: options.name },
      };
      ws.send(JSON.stringify(msg));
    });
    ws.on('error', reject);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;

      switch (msg.type) {
        case 'session_created':
          console.log(`✓ Session created: ${msg.payload.sessionId}`);
          console.log(`\nShare with your team: quorum join ${msg.payload.sessionId}\n`);
          console.log('Waiting for members...');
          resolve();
          break;

        case 'member_joined':
          console.log(`  → ${msg.payload.name} joined`);
          members.push({
            id: msg.payload.memberId,
            name: msg.payload.name,
            connectedAt: new Date().toISOString(),
          });
          setMembers(members);
          break;

        case 'member_left':
          console.log(`  ← ${msg.payload.name} left`);
          const idx = members.findIndex(m => m.id === msg.payload.memberId);
          if (idx !== -1) members.splice(idx, 1);
          setMembers(members);
          break;

        case 'tool_request': {
          // Handle tool request from a member
          const { requestId, tool, args } = msg.payload;
          handleToolRequest(server, tool, args).then((result) => {
            const response: ClientMessage = {
              type: 'tool_response',
              payload: { requestId, result },
            };
            ws.send(JSON.stringify(response));
          }).catch((error) => {
            const response: ClientMessage = {
              type: 'tool_response',
              payload: {
                requestId,
                result: null,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            };
            ws.send(JSON.stringify(response));
          });
          break;
        }
      }
    });
  });

  // Also start local MCP server for the host's own Claude Code
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nStopping session...');
    ws.close();
    await server.close();
    process.exit(0);
  });
}

async function handleToolRequest(
  server: ReturnType<typeof createQuorumServer>['server'],
  tool: string,
  args: Record<string, unknown>
): Promise<unknown> {
  // We need to call the tool handler directly on the store
  // This is handled by the MCP server internally when used via transport
  // For relay-forwarded requests, we call the store directly
  // This will be refined in integration — for now, re-use the store
  throw new Error('Direct tool dispatch not yet implemented');
}
```

**Step 3: Create the `join` command**

`packages/cli/src/commands/join.ts`:
```typescript
import WebSocket from 'ws';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpProxy } from '../proxy/mcp-proxy.js';
import { RELAY_URL } from '../config.js';
import type { ClientMessage, RelayMessage } from '@quorum/shared';
import { generateId } from '@quorum/shared';

export async function joinCommand(sessionId: string, options: { name: string }) {
  const memberId = generateId();

  console.log(`Joining session ${sessionId}...`);

  const ws = new WebSocket(RELAY_URL);

  // Pending tool requests waiting for responses
  const pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();

  // Tool handler that forwards requests through relay to host
  const toolHandler = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const requestId = generateId();
    const msg: ClientMessage = {
      type: 'tool_request',
      payload: { requestId, tool: name, args },
    };

    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject });
      ws.send(JSON.stringify(msg));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('Tool request timed out'));
        }
      }, 30000);
    });
  };

  const { server: proxyServer, setTools } = createMcpProxy(toolHandler);

  // Set up the default tools (these match the host's tool names)
  setTools([
    { name: 'get_context', description: 'Get shared project context', inputSchema: { type: 'object', properties: {} } },
    { name: 'post_decision', description: 'Record an architecture decision', inputSchema: { type: 'object', properties: {} } },
    { name: 'flag_dependency', description: 'Declare a dependency', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_dependencies', description: 'View dependencies', inputSchema: { type: 'object', properties: {} } },
    { name: 'sync', description: 'Get full session snapshot', inputSchema: { type: 'object', properties: {} } },
    { name: 'post_interface', description: 'Define an API contract', inputSchema: { type: 'object', properties: {} } },
    { name: 'resolve_dependency', description: 'Resolve a dependency', inputSchema: { type: 'object', properties: {} } },
    { name: 'raise_conflict', description: 'Flag a conflict', inputSchema: { type: 'object', properties: {} } },
    { name: 'resolve_conflict', description: 'Resolve a conflict', inputSchema: { type: 'object', properties: {} } },
  ]);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      const msg: ClientMessage = {
        type: 'join_session',
        payload: { sessionId, memberId, name: options.name },
      };
      ws.send(JSON.stringify(msg));
    });
    ws.on('error', reject);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;

      switch (msg.type) {
        case 'member_joined':
          if (msg.payload.memberId === memberId) {
            console.log(`✓ Connected to session ${sessionId}`);
            console.log('✓ MCP tools available');
            resolve();
          } else {
            console.log(`  → ${msg.payload.name} joined`);
          }
          break;

        case 'member_left':
          console.log(`  ← ${msg.payload.name} left`);
          break;

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

        case 'error':
          console.error(`Error: ${msg.payload.message}`);
          break;
      }
    });
  });

  // Start the proxy MCP server on stdio for Claude Code
  const transport = new StdioServerTransport();
  await proxyServer.connect(transport);

  process.on('SIGINT', async () => {
    console.log('\nLeaving session...');
    const msg: ClientMessage = {
      type: 'leave_session',
      payload: { memberId },
    };
    ws.send(JSON.stringify(msg));
    ws.close();
    await proxyServer.close();
    process.exit(0);
  });
}
```

**Step 4: Create the `status` command**

`packages/cli/src/commands/status.ts`:
```typescript
export async function statusCommand() {
  // TODO: Read from a local session state file
  console.log('No active session. Use `quorum start` or `quorum join <id>`.');
}
```

**Step 5: Create the `export-context` command**

`packages/cli/src/commands/export-context.ts`:
```typescript
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { ContextStore } from '@quorum/server';
import { generateContextMarkdown } from '../export.js';

export async function exportCommand() {
  const storeDir = join(process.cwd(), '.collab');
  const store = new ContextStore(storeDir);

  try {
    const data = await store.getData();
    const markdown = generateContextMarkdown(data, []);
    const outputPath = join(process.cwd(), '.collab', 'context.md');
    await mkdir(join(process.cwd(), '.collab'), { recursive: true });
    await writeFile(outputPath, markdown);
    console.log(`✓ Context exported to ${outputPath}`);
  } catch {
    console.error('No session data found. Start a session first.');
  }
}
```

**Step 6: Update CLI entry point**

`packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { joinCommand } from './commands/join.js';
import { statusCommand } from './commands/status.js';
import { exportCommand } from './commands/export-context.js';

const program = new Command();

program
  .name('quorum')
  .description('Keep your team\'s AI agents in sync')
  .version('0.1.0');

program
  .command('start')
  .description('Start a new shared session (you become the host)')
  .option('-n, --name <name>', 'Your display name', 'Host')
  .action(startCommand);

program
  .command('join <sessionId>')
  .description('Join an existing shared session')
  .option('-n, --name <name>', 'Your display name', 'Member')
  .action(joinCommand);

program
  .command('status')
  .description('Show current session info')
  .action(statusCommand);

program
  .command('export')
  .description('Export session context to .collab/context.md')
  .action(exportCommand);

program.parse();
```

**Step 7: Build and verify CLI runs**

Run: `npm run build && node packages/cli/dist/index.js --help`
Expected: Shows help output with start, join, status, export commands.

**Step 8: Commit**

```bash
git add packages/cli/
git commit -m "feat: implement CLI commands (start, join, status, export)

Host can start sessions, teammates can join via session ID.
Tool calls forwarded through WebSocket relay."
```

---

### Task 8: Context Export (Markdown generation)

**Files:**
- Create: `packages/cli/src/export.ts`
- Create: `packages/cli/src/__tests__/export.test.ts`

**Step 1: Write failing test for markdown export**

`packages/cli/src/__tests__/export.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateContextMarkdown } from '../export.js';
import type { Decision, Dependency, Interface, Conflict, Member } from '@quorum/shared';

describe('generateContextMarkdown', () => {
  it('generates markdown with all sections', () => {
    const data = {
      brief: 'Build a task management API',
      decisions: [
        {
          id: '1', title: 'Use PostgreSQL', description: 'Primary database',
          rationale: 'Strong typing, JSONB', author: 'alice',
          timestamp: '2026-03-04T12:00:00Z', tags: ['database'],
        },
      ] as Decision[],
      dependencies: [
        {
          id: '2', from: 'alice', to: 'bob',
          description: 'Need user endpoint', priority: 'blocking' as const,
          status: 'resolved' as const, resolution: 'GET /users/:id',
          timestamp: '2026-03-04T12:05:00Z',
        },
      ] as Dependency[],
      interfaces: [
        {
          id: '3', name: 'User API', between: ['auth', 'users'] as [string, string],
          specification: 'GET /users/:id → { id, email }',
          author: 'bob', status: 'agreed' as const,
          timestamp: '2026-03-04T12:10:00Z',
        },
      ] as Interface[],
      conflicts: [] as Conflict[],
    };

    const members: Member[] = [
      { id: 'a', name: 'Alice', connectedAt: '2026-03-04T12:00:00Z' },
      { id: 'b', name: 'Bob', connectedAt: '2026-03-04T12:01:00Z' },
    ];

    const md = generateContextMarkdown(data, members);

    expect(md).toContain('# Project Context');
    expect(md).toContain('## Brief');
    expect(md).toContain('Build a task management API');
    expect(md).toContain('## Team');
    expect(md).toContain('Alice');
    expect(md).toContain('## Decisions');
    expect(md).toContain('Use PostgreSQL');
    expect(md).toContain('## Interfaces');
    expect(md).toContain('User API');
    expect(md).toContain('## Dependencies');
    expect(md).toContain('Need user endpoint');
  });

  it('marks superseded decisions with strikethrough', () => {
    const data = {
      brief: '',
      decisions: [
        {
          id: '1', title: 'Use REST', description: '', rationale: '',
          author: 'alice', timestamp: '', tags: [], supersededBy: '2',
        },
        {
          id: '2', title: 'Use GraphQL', description: '', rationale: '',
          author: 'bob', timestamp: '', tags: [],
        },
      ] as Decision[],
      dependencies: [],
      interfaces: [],
      conflicts: [],
    };

    const md = generateContextMarkdown(data, []);
    expect(md).toContain('~~Use REST~~');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/__tests__/export.test.ts`
Expected: FAIL — cannot find module `../export.js`

**Step 3: Implement markdown export**

`packages/cli/src/export.ts`:
```typescript
import type { Decision, Dependency, Interface, Conflict, Member } from '@quorum/shared';

interface ExportData {
  brief: string;
  decisions: Decision[];
  dependencies: Dependency[];
  interfaces: Interface[];
  conflicts: Conflict[];
}

export function generateContextMarkdown(data: ExportData, members: Member[]): string {
  const lines: string[] = [];

  lines.push('# Project Context');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Brief
  if (data.brief) {
    lines.push('## Brief');
    lines.push(data.brief);
    lines.push('');
  }

  // Team
  if (members.length > 0) {
    lines.push('## Team');
    for (const m of members) {
      lines.push(`- ${m.name}`);
    }
    lines.push('');
  }

  // Decisions
  if (data.decisions.length > 0) {
    lines.push('## Decisions');
    for (const d of data.decisions) {
      const title = d.supersededBy ? `~~${d.title}~~` : d.title;
      lines.push(`### ${title} (${d.author})`);
      if (d.supersededBy) {
        lines.push(`*Superseded by decision ${d.supersededBy}*`);
      }
      if (d.description) {
        lines.push(d.description);
      }
      if (d.rationale) {
        lines.push(`- **Rationale:** ${d.rationale}`);
      }
      if (d.tags.length > 0) {
        lines.push(`- **Tags:** ${d.tags.join(', ')}`);
      }
      lines.push('');
    }
  }

  // Interfaces
  if (data.interfaces.length > 0) {
    lines.push('## Interfaces');
    for (const i of data.interfaces) {
      lines.push(`### ${i.name} (${i.between[0]} ↔ ${i.between[1]})`);
      lines.push(`- **Status:** ${i.status}`);
      lines.push(`- **Spec:** ${i.specification}`);
      lines.push('');
    }
  }

  // Dependencies
  if (data.dependencies.length > 0) {
    lines.push('## Dependencies');
    for (const d of data.dependencies) {
      lines.push(`### ${d.from} → ${d.to}: ${d.description}`);
      lines.push(`- **Priority:** ${d.priority}`);
      lines.push(`- **Status:** ${d.status}`);
      if (d.resolution) {
        lines.push(`- **Resolution:** ${d.resolution}`);
      }
      lines.push('');
    }
  }

  // Conflicts
  const openConflicts = data.conflicts.filter(c => c.status === 'open');
  const resolvedConflicts = data.conflicts.filter(c => c.status === 'resolved');

  if (openConflicts.length > 0) {
    lines.push('## Open Conflicts');
    for (const c of openConflicts) {
      lines.push(`### ${c.description}`);
      lines.push(`- **Raised by:** ${c.author}`);
      lines.push(`- **Items:** ${c.itemIds.join(', ')}`);
      lines.push('');
    }
  }

  if (resolvedConflicts.length > 0) {
    lines.push('## Resolved Conflicts');
    for (const c of resolvedConflicts) {
      lines.push(`### ${c.description}`);
      lines.push(`- **Resolution:** ${c.resolution}`);
      if (c.supersedes) {
        lines.push(`- **Superseded:** ${c.supersedes}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npm run build && cd ../server && npm run build && cd ../cli && npx vitest run src/__tests__/export.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/cli/src/export.ts packages/cli/src/__tests__/export.test.ts
git commit -m "feat: implement context export to markdown"
```

---

### Task 9: Host-side tool dispatch for relay requests

The `start` command currently throws "not yet implemented" when receiving tool requests from the relay. We need the host to execute tool calls from teammates against its local ContextStore.

**Files:**
- Create: `packages/server/src/tool-dispatcher.ts`
- Create: `packages/server/src/__tests__/tool-dispatcher.test.ts`
- Modify: `packages/cli/src/commands/start.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Write failing test for tool dispatcher**

`packages/server/src/__tests__/tool-dispatcher.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextStore } from '../store/context-store.js';
import { createToolDispatcher } from '../tool-dispatcher.js';

describe('ToolDispatcher', () => {
  let store: ContextStore;
  let dispatch: ReturnType<typeof createToolDispatcher>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-dispatch-test-'));
    store = new ContextStore(tempDir);
    dispatch = createToolDispatcher(store);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('dispatches post_decision and returns result', async () => {
    const result = await dispatch('post_decision', {
      title: 'Use JWT',
      description: 'JWT for auth',
      rationale: 'Stateless',
      author: 'alice',
      tags: ['auth'],
    });
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('timestamp');
  });

  it('dispatches get_context and returns data', async () => {
    await dispatch('post_decision', {
      title: 'Use JWT', description: '', rationale: '', author: 'alice', tags: [],
    });

    const result = await dispatch('get_context', {}) as { decisions: unknown[] };
    expect(result.decisions).toHaveLength(1);
  });

  it('throws on unknown tool', async () => {
    await expect(dispatch('unknown_tool', {})).rejects.toThrow('Unknown tool');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/tool-dispatcher.test.ts`
Expected: FAIL — cannot find module

**Step 3: Implement tool dispatcher**

`packages/server/src/tool-dispatcher.ts`:
```typescript
import { ContextStore } from './store/context-store.js';

export function createToolDispatcher(store: ContextStore) {
  return async function dispatch(
    tool: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    switch (tool) {
      case 'get_context': {
        const filter = args.filter as string | undefined;
        const context = await store.getContext();
        if (filter && filter !== 'all') {
          return { [filter]: (context as Record<string, unknown>)[filter], members: context.members };
        }
        return context;
      }

      case 'post_decision':
        return store.addDecision({
          title: args.title as string,
          description: args.description as string,
          rationale: args.rationale as string,
          author: args.author as string,
          tags: (args.tags as string[]) ?? [],
        });

      case 'flag_dependency':
        return store.addDependency({
          from: args.from as string,
          to: args.to as string,
          description: args.description as string,
          priority: args.priority as 'blocking' | 'nice-to-have',
        });

      case 'get_dependencies':
        return {
          dependencies: await store.getDependencies({
            member: args.member as string | undefined,
            status: args.status as 'open' | 'resolved' | undefined,
          }),
        };

      case 'sync': {
        const context = await store.getContext();
        return {
          members: context.members,
          recentDecisions: context.decisions.slice(-10),
          openDependencies: context.dependencies.filter(d => d.status === 'open'),
          unresolvedInterfaces: context.interfaces.filter(i => i.status === 'proposed'),
          openConflicts: context.conflicts.filter(c => c.status === 'open'),
        };
      }

      case 'post_interface':
        return store.addInterface({
          name: args.name as string,
          between: args.between as [string, string],
          specification: args.specification as string,
          author: args.author as string,
        });

      case 'resolve_dependency':
        return store.resolveDependency(
          args.dependencyId as string,
          args.resolution as string
        );

      case 'raise_conflict':
        return store.raiseConflict({
          itemIds: args.itemIds as [string, string],
          description: args.description as string,
          author: args.author as string,
        });

      case 'resolve_conflict':
        return store.resolveConflict(
          args.conflictId as string,
          args.resolution as string,
          args.supersedes as string | undefined
        );

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/__tests__/tool-dispatcher.test.ts`
Expected: All tests PASS

**Step 5: Update start command to use tool dispatcher**

Modify `packages/cli/src/commands/start.ts` — replace the `handleToolRequest` function:

Replace the existing `handleToolRequest` function and add the import:
```typescript
// Add to imports:
import { createToolDispatcher } from '@quorum/server';

// Replace the handleToolRequest function and update the startCommand to use dispatcher:
```

In `startCommand`, add after creating the server:
```typescript
const dispatch = createToolDispatcher(store);
```

Replace the `case 'tool_request'` handler:
```typescript
case 'tool_request': {
  const { requestId, tool, args } = msg.payload;
  dispatch(tool, args as Record<string, unknown>).then((result) => {
    const response: ClientMessage = {
      type: 'tool_response',
      payload: { requestId, result },
    };
    ws.send(JSON.stringify(response));
  }).catch((error) => {
    const response: ClientMessage = {
      type: 'tool_response',
      payload: {
        requestId,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
    ws.send(JSON.stringify(response));
  });
  break;
}
```

Remove the old standalone `handleToolRequest` function.

**Step 6: Update server index.ts**

`packages/server/src/index.ts`:
```typescript
export { ContextStore } from './store/context-store.js';
export { createQuorumServer } from './mcp/server.js';
export { createToolDispatcher } from './tool-dispatcher.js';
```

**Step 7: Build and verify**

Run: `npm run build`
Expected: All packages build successfully.

**Step 8: Commit**

```bash
git add packages/server/ packages/cli/
git commit -m "feat: implement tool dispatcher for relay-forwarded requests

Host can now execute tool calls received from teammates through
the relay, using the same ContextStore backing the local MCP server."
```

---

### Task 10: Integration Test (end-to-end)

**Files:**
- Create: `packages/cli/src/__tests__/integration.test.ts`

**Step 1: Write integration test**

This test spins up a relay, a host, and a member, and verifies that a tool call from the member reaches the host and returns a result.

`packages/cli/src/__tests__/integration.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRelay } from '@quorum/relay';
import { ContextStore, createToolDispatcher } from '@quorum/server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import type { ClientMessage, RelayMessage } from '@quorum/shared';
import { generateId } from '@quorum/shared';

const TEST_PORT = 9878;

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<RelayMessage> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()) as RelayMessage);
    });
  });
}

function send(ws: WebSocket, msg: ClientMessage): void {
  ws.send(JSON.stringify(msg));
}

describe('Integration: Host + Relay + Member', () => {
  let relay: ReturnType<typeof createRelay>;
  let tempDir: string;

  beforeEach(async () => {
    relay = createRelay(TEST_PORT);
    await relay.start();
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-integration-'));
  });

  afterEach(async () => {
    await relay.stop();
    await rm(tempDir, { recursive: true });
  });

  it('member can post a decision through the relay to the host', async () => {
    const store = new ContextStore(tempDir);
    const dispatch = createToolDispatcher(store);

    // Host connects and creates session
    const host = await connectClient(TEST_PORT);
    const createPromise = waitForMessage(host);
    send(host, { type: 'create_session', payload: { hostId: 'host-1', name: 'Alice' } });
    const sessionCreated = await createPromise;
    const sessionId = (sessionCreated.payload as { sessionId: string }).sessionId;

    // Host listens for tool_requests and dispatches them
    host.on('message', async (data) => {
      const msg = JSON.parse(data.toString()) as RelayMessage;
      if (msg.type === 'tool_request') {
        const { requestId, tool, args } = msg.payload;
        try {
          const result = await dispatch(tool, args as Record<string, unknown>);
          send(host, { type: 'tool_response', payload: { requestId, result } });
        } catch (error) {
          send(host, {
            type: 'tool_response',
            payload: { requestId, result: null, error: (error as Error).message },
          });
        }
      }
    });

    // Member connects and joins
    const member = await connectClient(TEST_PORT);
    const joinPromise = waitForMessage(member);
    send(member, {
      type: 'join_session',
      payload: { sessionId, memberId: 'member-1', name: 'Bob' },
    });
    await joinPromise; // member_joined

    // Member sends a tool_request
    const requestId = generateId();
    const responsePromise = waitForMessage(member);
    send(member, {
      type: 'tool_request',
      payload: {
        requestId,
        tool: 'post_decision',
        args: {
          title: 'Use GraphQL',
          description: 'GraphQL for API',
          rationale: 'Flexible queries',
          author: 'bob',
          tags: ['api'],
        },
      },
    });

    const response = await responsePromise;
    expect(response.type).toBe('tool_response');
    const result = response.payload as { requestId: string; result: { id: string; timestamp: string } };
    expect(result.result.id).toBeDefined();

    // Verify the decision was persisted on the host
    const decisions = await store.getDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.title).toBe('Use GraphQL');
    expect(decisions[0]!.author).toBe('bob');

    host.close();
    member.close();
  });
});
```

**Step 2: Run integration test**

Run: `cd packages/shared && npm run build && cd ../server && npm run build && cd ../relay && npm run build && cd ../cli && npx vitest run src/__tests__/integration.test.ts`
Expected: PASS

**Step 3: Run all tests across the monorepo**

Run: `npm run test`
Expected: All tests across all packages PASS.

**Step 4: Commit**

```bash
git add packages/cli/src/__tests__/integration.test.ts
git commit -m "test: add end-to-end integration test

Verifies full flow: host creates session, member joins, member posts
a decision through relay, host persists it in ContextStore."
```

---

### Task 11: Final cleanup and first release prep

**Files:**
- Create: `packages/relay/Dockerfile`
- Modify: `packages/cli/package.json` (add bin field verification)
- Create: `CLAUDE.md`

**Step 1: Create Dockerfile for relay**

`packages/relay/Dockerfile`:
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY packages/relay/dist ./dist
COPY packages/relay/package.json ./
COPY packages/shared/dist ./node_modules/@quorum/shared/dist
COPY packages/shared/package.json ./node_modules/@quorum/shared/
RUN npm install --omit=dev
EXPOSE 7777
CMD ["node", "dist/index.js"]
```

**Step 2: Create CLAUDE.md**

`CLAUDE.md`:
```markdown
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
```

**Step 3: Verify full build and all tests pass**

Run: `npm run build && npm run test`
Expected: Everything passes.

**Step 4: Commit**

```bash
git add .
git commit -m "chore: add Dockerfile for relay and CLAUDE.md project docs"
```
