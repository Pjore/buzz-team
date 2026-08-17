import { createRequire } from 'module';
import { execSync } from 'child_process';

// nostr-tools and ws must be installed globally: npm install -g nostr-tools ws
function loadGlobalModule(name) {
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(import.meta.url)(`${globalRoot}/${name}`);
}

export async function publishProfile(privkeyHex, pubkeyHex, name, emoji, relayUrl) {
  let NT, WS;
  try {
    NT = loadGlobalModule('nostr-tools');
    WS = loadGlobalModule('ws');
  } catch {
    console.log(`  WARN: nostr-tools or ws not found globally — skipping profile publish`);
    console.log('  To publish manually: npm install -g nostr-tools ws && node src/scripts/publish-agent-profiles.js <priv> <pub> "<name>" "<emoji>"');
    return false;
  }

  return new Promise(resolve => {
    const ws = new WS(relayUrl);
    let state = 'waiting_auth';

    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString());
      if (msg[0] === 'AUTH' && state === 'waiting_auth') {
        const authEv = NT.finalizeEvent({
          kind: 22242,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['relay', relayUrl], ['challenge', msg[1]]],
          content: '',
        }, Buffer.from(privkeyHex, 'hex'));
        ws.send(JSON.stringify(['AUTH', authEv]));
        state = 'waiting_auth_ok';
      } else if (msg[0] === 'OK' && state === 'waiting_auth_ok') {
        if (!msg[2]) { console.log(`  WARN: relay auth rejected — ${msg[3]}`); ws.close(); return resolve(false); }
        const profileEv = NT.finalizeEvent({
          kind: 0,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ name, display_name: `${name} ${emoji}`, about: 'AI coding agent' }),
        }, Buffer.from(privkeyHex, 'hex'));
        ws.send(JSON.stringify(['EVENT', profileEv]));
        state = 'waiting_event_ok';
      } else if (msg[0] === 'OK' && state === 'waiting_event_ok') {
        const ok = msg[2];
        console.log(`  Profile: ${ok ? '✓ published' : `✗ rejected — ${msg[3]}`}`);
        ws.close(); resolve(ok);
      }
    });
    ws.on('error', e => { console.log(`  WARN: profile publish failed — ${e.message}`); resolve(false); });
    setTimeout(() => { ws.close(); resolve(false); }, 8000);
  });
}
