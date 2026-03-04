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
