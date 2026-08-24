import { execSync } from 'child_process';
import { loadConfig } from './config.js';
import { readCreds } from './credentials.js';
import { derivePublicKey } from './nostr.js';

export async function join(name, opts = {}) {
  const config = loadConfig(opts);
  const creds = readCreds(name);
  if (!creds.BUZZ_PRIVATE_KEY) {
    console.error(`ERROR: no Nostr key for "${name}" — run: buzz-team key create ${name}`);
    process.exit(1);
  }
  const pubkey = derivePublicKey(creds.BUZZ_PRIVATE_KEY);

  if (!config.BUZZ_RELAY_SSH) {
    console.log('  WARN: BUZZ_RELAY_SSH not set — skipping relay enrollment');
    return;
  }

  console.log(`  Enrolling pubkey in relay…`);
  const keyArg = config.BUZZ_RELAY_SSH_KEY ? `-i ${config.BUZZ_RELAY_SSH_KEY} ` : '';
  const cmd = `ssh ${keyArg}-o StrictHostKeyChecking=no ${config.BUZZ_RELAY_SSH} 'docker exec $(docker ps --filter name=-relay- --format "{{.ID}}" | head -1) buzz-admin add-member --pubkey ${pubkey} --role member'`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('  Relay enrollment done');
}

export async function leave(name, opts = {}) {
  const config = loadConfig(opts);
  const creds = readCreds(name);
  if (!creds.BUZZ_PRIVATE_KEY) {
    console.error(`ERROR: no Nostr key for "${name}"`);
    process.exit(1);
  }
  const pubkey = derivePublicKey(creds.BUZZ_PRIVATE_KEY);

  if (!config.BUZZ_RELAY_SSH) {
    console.log('  WARN: BUZZ_RELAY_SSH not set — skipping relay membership removal');
    return;
  }

  const keyArg = config.BUZZ_RELAY_SSH_KEY ? `-i ${config.BUZZ_RELAY_SSH_KEY} ` : '';
  const cmd = `ssh ${keyArg}-o StrictHostKeyChecking=no ${config.BUZZ_RELAY_SSH} 'docker exec $(docker ps --filter name=-relay- --format "{{.ID}}" | head -1) buzz-admin remove-member --pubkey ${pubkey}'`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('  Relay membership removed (profile is kept)');
}
