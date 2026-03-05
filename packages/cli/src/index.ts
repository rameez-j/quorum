#!/usr/bin/env node
import { Command } from 'commander';
import { exportCommand } from './commands/export-context.js';
import { registerMcpServer, unregisterMcpServer, getSettingsPath } from './config.js';

const program = new Command();

program
  .name('quorum')
  .description('Keep your team\'s AI agents in sync')
  .version('0.1.0');

program
  .command('install')
  .description('Register Quorum as an MCP server in Claude Code')
  .option('--project', 'Register in project-level settings instead of global')
  .action(async (options: { project?: boolean }) => {
    const path = getSettingsPath(!!options.project);
    await registerMcpServer(path);
    const scope = options.project ? 'project' : 'global';
    console.log(`✓ Quorum registered in ${scope} Claude Code settings`);
    console.log('  Restart Claude Code to activate.');
  });

program
  .command('uninstall')
  .description('Remove Quorum from Claude Code settings')
  .option('--project', 'Remove from project-level settings instead of global')
  .action(async (options: { project?: boolean }) => {
    const path = getSettingsPath(!!options.project);
    await unregisterMcpServer(path);
    const scope = options.project ? 'project' : 'global';
    console.log(`✓ Quorum removed from ${scope} Claude Code settings`);
  });

program
  .command('serve')
  .description('Start the Quorum MCP server (used by Claude Code, not run directly)')
  .action(async () => {
    const { serveCommand } = await import('./commands/serve.js');
    await serveCommand();
  });

program
  .command('export')
  .description('Export session context to .collab/context.md')
  .action(exportCommand);

program.parse();
