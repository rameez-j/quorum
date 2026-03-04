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
