#!/usr/bin/env node
import { Command } from 'commander';
import { init } from '../commands/init.js';
import * as key from '../commands/key.js';
import * as app from '../commands/app.js';
import * as community from '../commands/community.js';
import * as profile from '../commands/profile.js';
import * as id from '../commands/id.js';
import * as workspaceCreate from '../commands/workspace/create.js';
import * as workspaceUpdate from '../commands/workspace/update.js';
import * as workspaceDelete from '../commands/workspace/delete.js';
import * as workspaceSoul from '../commands/workspace/soul-cmd.js';
import { auth } from '../commands/auth.js';

const program = new Command();

program
  .name('buzz-team')
  .description('Manage buzz-team AI agents')
  .version('0.2.0');

program
  .command('init')
  .description('Scaffold agents.yaml, AGENTS.md, SOUL.md, and .env.example in current directory')
  .action(init);

const keyCmd = program.command('key').description("Manage an agent's Nostr keypair");

keyCmd
  .command('create <name>')
  .description("Generate (or reuse) an agent's Nostr keypair")
  .action(key.create);

const appCmd = program.command('app').description("Manage an agent's GitHub App identity");

appCmd
  .command('create <name>')
  .description("Create an agent's GitHub App identity via the manifest flow")
  .option('--github-token <token>', 'GitHub personal access token')
  .action(app.create);

appCmd
  .command('update <name>')
  .description("Sync repo access for an existing agent's GitHub App installation")
  .option('--github-token <token>', 'GitHub personal access token')
  .action(app.update);

const communityCmd = program.command('community').description('Manage an agent\'s relay membership');

communityCmd
  .command('join <name>')
  .description("Enroll an agent's pubkey in the relay")
  .option('--relay-ssh <url>', 'SSH URL to relay server (e.g. root@relay.example.com)')
  .action(community.join);

communityCmd
  .command('leave <name>')
  .description("Remove an agent's relay membership")
  .option('--relay-ssh <url>', 'SSH URL to relay server (e.g. root@relay.example.com)')
  .action(community.leave);

const profileCmd = program.command('profile').description("Manage an agent's Nostr profile");

profileCmd
  .command('publish <name>')
  .description("Publish an agent's Nostr profile to the relay")
  .action(profile.publish);

const idCmd = program.command('id').description('Manage an agent identity (key + GitHub App + relay + profile)');

idCmd
  .command('create <name>')
  .description('Create a new agent identity: Nostr key + GitHub App + relay enrollment + profile')
  .option('--relay-ssh <url>', 'SSH URL to relay server (e.g. root@relay.example.com)')
  .option('--github-token <token>', 'GitHub personal access token')
  .action(id.create);

idCmd
  .command('delete <name>')
  .description('Uninstall a GitHub App, remove relay membership, and delete its credential file')
  .option('--relay-ssh <url>', 'SSH URL to relay server (e.g. root@relay.example.com)')
  .action(id.del);

const workspaceCmd = program.command('workspace').description("Manage an agent's workspace");

workspaceCmd
  .command('create <name>')
  .description("Provision a running workspace for an agent and push its persona")
  .action(workspaceCreate.create);

workspaceCmd
  .command('update <name>')
  .description("Update an agent's workspace and re-push its persona")
  .option('--soul-only', 'Skip the backend update, only re-push AGENTS.md/SOUL.md')
  .action(workspaceUpdate.update);

workspaceCmd
  .command('delete <name>')
  .description("Tear down an agent's workspace")
  .action(workspaceDelete.del);

const workspaceSoulCmd = workspaceCmd.command('soul').description("Manage an agent's persona files on its workspace");

workspaceSoulCmd
  .command('push <name>')
  .description('Push AGENTS.md/SOUL.md into a running workspace and restart buzz-acp')
  .action(workspaceSoul.push);

program
  .command('auth <name>')
  .description('Run interactive AI provider auth inside a running agent container')
  .option('--ssh <host>', 'SSH directly into this host (e.g. buzz-fry.coder) without Docker')
  .option('--relay-ssh <url>', 'SSH URL to Docker relay host (e.g. root@relay.example.com)')
  .option('--ssh-key <path>', 'Path to SSH private key')
  .action(auth);

await program.parseAsync();
process.exit(0);
