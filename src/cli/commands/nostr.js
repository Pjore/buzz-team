import * as secp from '@noble/secp256k1';

const toHex = (bytes) => Buffer.from(bytes).toString('hex');
const fromHex = (hex) => Buffer.from(hex, 'hex');

export function generateKeypair() {
  const privBytes = secp.utils.randomPrivateKey();
  const pubBytes = secp.getPublicKey(privBytes, true).slice(1); // x-only (32 bytes)
  return {
    privkey: toHex(privBytes),
    pubkey: toHex(pubBytes),
  };
}

export function derivePublicKey(privkeyHex) {
  const pubBytes = secp.getPublicKey(fromHex(privkeyHex), true).slice(1);
  return toHex(pubBytes);
}
