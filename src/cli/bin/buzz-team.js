#!/usr/bin/env node
import { Command } from 'commander';
import { init } from '../commands/init.js';
import { create } from '../commands/create.js';
import { update } from '../commands/update.js';
import { del } from '../commands/delete.js';
import { auth } from '../commands/auth.js';

const program = new Command();

program
  .name('buzz-team')
  .description('Manage buzz-team AI agents')
  .version('0.1.0');

program
  .command('init')
  .description('Scaffold agents.yaml, AGENTS.md, SOUL.md, and .env.example in current directory')
  .action(init);

program
  .command('create <name>')
  .description('Create a new agent: GitHub App + Nostr keypair + relay enrollment')
  .option('--relay-ssh <url>', 'SSH URL to relay server (e.g. root@relay.example.com)')
  .option('--github-token <token>', 'GitHub personal access token')
  .action(create);

program
  .command('update <name>')
  .description('Sync repo access for an existing agent')
  .option('--github-token <token>', 'GitHub personal access token')
  .action(update);

program
  .command('delete <name>')
  .description('Remove a GitHub App and its credential file')
  .option('--github-token <token>', 'GitHub personal access token')
  .action(del);

program
  .command('auth <name>')
  .description('Run interactive AI provider auth inside a running agent container')
  .option('--ssh <host>', 'SSH directly into this host (e.g. buzz-fry.coder) without Docker')
  .option('--relay-ssh <url>', 'SSH URL to Docker relay host (e.g. root@relay.example.com)')
  .option('--ssh-key <path>', 'Path to SSH private key')
  .action(auth);

await program.parseAsync();
process.exit(0);
