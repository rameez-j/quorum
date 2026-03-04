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
