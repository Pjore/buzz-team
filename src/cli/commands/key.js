import { readCreds, writeCreds } from './credentials.js';
import { generateKeypair, derivePublicKey } from './nostr.js';

export async function create(name) {
  const existing = readCreds(name);
  if (existing.BUZZ_PRIVATE_KEY) {
    const pubkey = derivePublicKey(existing.BUZZ_PRIVATE_KEY);
    console.log(`  Nostr pubkey (existing): ${pubkey}`);
    return { privkey: existing.BUZZ_PRIVATE_KEY, pubkey };
  }

  const { privkey, pubkey } = generateKeypair();
  writeCreds(name, { BUZZ_PRIVATE_KEY: privkey });
  console.log(`  Nostr pubkey: ${pubkey}`);
  return { privkey, pubkey };
}
