import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const MCP_SERVER_NAME = 'quorum';

interface ClaudeSettings {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
  [key: string]: unknown;
}

export function getSettingsPath(project: boolean): string {
  if (project) {
    return join(process.cwd(), '.claude', 'settings.json');
  }
  return join(homedir(), '.claude', 'settings.json');
}

export async function registerMcpServer(settingsPath: string): Promise<void> {
  let settings: ClaudeSettings = {};
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    settings = JSON.parse(raw) as ClaudeSettings;
  } catch {
    // File doesn't exist yet
  }

  settings.mcpServers ??= {};
  settings.mcpServers[MCP_SERVER_NAME] = {
    command: 'npx',
    args: ['-y', 'quorum', 'serve'],
  };

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

export async function unregisterMcpServer(settingsPath: string): Promise<void> {
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as ClaudeSettings;
    if (settings.mcpServers) {
      delete settings.mcpServers[MCP_SERVER_NAME];
    }
    await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  } catch {
    // File doesn't exist, nothing to clean up
  }
}

export const RELAY_URL = process.env['QUORUM_RELAY_URL'] ?? 'ws://localhost:7777';
