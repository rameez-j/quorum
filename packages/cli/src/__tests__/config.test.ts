import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { registerMcpServer, unregisterMcpServer, getSettingsPath } from '../config.js';

describe('config', () => {
  let tempDir: string;
  let settingsPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quorum-config-'));
    settingsPath = join(tempDir, 'settings.json');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('registers quorum MCP server in settings file', async () => {
    await registerMcpServer(settingsPath);
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    expect(settings.mcpServers.quorum).toEqual({
      command: 'npx',
      args: ['-y', 'quorum', 'serve'],
    });
  });

  it('preserves existing settings when registering', async () => {
    const existing = { someKey: 'someValue', mcpServers: { other: { command: 'foo' } } };
    await mkdir(tempDir, { recursive: true });
    await writeFile(settingsPath, JSON.stringify(existing));

    await registerMcpServer(settingsPath);
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    expect(settings.someKey).toBe('someValue');
    expect(settings.mcpServers.other).toEqual({ command: 'foo' });
    expect(settings.mcpServers.quorum).toBeDefined();
  });

  it('unregisters quorum MCP server from settings file', async () => {
    await registerMcpServer(settingsPath);
    await unregisterMcpServer(settingsPath);
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    expect(settings.mcpServers.quorum).toBeUndefined();
  });

  it('unregister is a no-op when file does not exist', async () => {
    await unregisterMcpServer(join(tempDir, 'nonexistent.json'));
  });
});

describe('getSettingsPath', () => {
  it('returns global settings path when project is false', () => {
    const path = getSettingsPath(false);
    expect(path).toContain('.claude');
    expect(path).toContain('settings.json');
    expect(path).not.toBe(join(process.cwd(), '.claude', 'settings.json'));
  });

  it('returns project-level settings path when project is true', () => {
    const path = getSettingsPath(true);
    expect(path).toBe(join(process.cwd(), '.claude', 'settings.json'));
  });
});
