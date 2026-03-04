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
