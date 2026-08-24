import { readCreds } from './credentials.js';
import { derivePublicKey } from './nostr.js';
import { publishProfile } from './publish-profile.js';

export async function publish(name) {
  const creds = readCreds(name);
  if (!creds.BUZZ_PRIVATE_KEY) {
    console.error(`ERROR: no Nostr key for "${name}" — run: buzz-team key create ${name}`);
    process.exit(1);
  }

  const relayUrl = process.env.BUZZ_RELAY_URL;
  if (!relayUrl) {
    console.error('ERROR: BUZZ_RELAY_URL is required — set it in .env or as an environment variable');
    process.exit(1);
  }

  const pubkey = derivePublicKey(creds.BUZZ_PRIVATE_KEY);
  console.log(`  Publishing Nostr profile to ${relayUrl}…`);
  await publishProfile(creds.BUZZ_PRIVATE_KEY, pubkey, name.charAt(0).toUpperCase() + name.slice(1), '🤖', relayUrl);
}
