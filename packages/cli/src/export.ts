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
      lines.push(`### ${i.name} (${i.between[0]} \u2194 ${i.between[1]})`);
      lines.push(`- **Status:** ${i.status}`);
      lines.push(`- **Spec:** ${i.specification}`);
      lines.push('');
    }
  }

  // Dependencies
  if (data.dependencies.length > 0) {
    lines.push('## Dependencies');
    for (const d of data.dependencies) {
      lines.push(`### ${d.from} \u2192 ${d.to}: ${d.description}`);
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
