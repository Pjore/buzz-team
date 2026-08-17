#!/usr/bin/env node
// Publish Nostr kind-0 profile events for buzz-team agents.
//
// Usage:
//   node publish-agent-profiles.js <priv> <pub> <name> <emoji> [<priv> <pub> <name> <emoji> ...]
//
// Requires: ws, nostr-tools (npm install -g ws nostr-tools)

'use strict';

const RELAY = process.env.BUZZ_RELAY_URL;
if (!RELAY) { console.error('BUZZ_RELAY_URL is required'); process.exit(1); }

const globalModules = require('child_process').execSync('npm root -g').toString().trim();
const NT = require(`${globalModules}/nostr-tools`);
const WS = require(`${globalModules}/ws`);

const args = process.argv.slice(2);
if (args.length < 4 || args.length % 4 !== 0) {
  console.error('Usage: publish-agent-profiles.js <priv> <pub> <name> <emoji> [...]');
  process.exit(1);
}

const agents = [];
for (let i = 0; i < args.length; i += 4) {
  agents.push({ priv: args[i], pub: args[i + 1], name: args[i + 2], emoji: args[i + 3] });
}

async function publishProfile(priv, pub, name, emoji) {
  return new Promise(resolve => {
    const ws = new WS(RELAY);
    let state = 'waiting_auth';

    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString());
      if (msg[0] === 'AUTH' && state === 'waiting_auth') {
        const authEv = NT.finalizeEvent({
          kind: 22242,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['relay', RELAY], ['challenge', msg[1]]],
          content: '',
        }, Buffer.from(priv, 'hex'));
        ws.send(JSON.stringify(['AUTH', authEv]));
        state = 'waiting_auth_ok';
      } else if (msg[0] === 'OK' && state === 'waiting_auth_ok') {
        if (!msg[2]) { console.error(`${name}: auth rejected — ${msg[3]}`); ws.close(); return resolve(false); }
        const profileEv = NT.finalizeEvent({
          kind: 0,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ name, display_name: `${name} ${emoji}`, about: 'AI coding agent' }),
        }, Buffer.from(priv, 'hex'));
        ws.send(JSON.stringify(['EVENT', profileEv]));
        state = 'waiting_event_ok';
      } else if (msg[0] === 'OK' && state === 'waiting_event_ok') {
        console.log(`${name} ${emoji}: ${msg[2] ? '✓ profile published' : `✗ rejected — ${msg[3]}`}`);
        ws.close(); resolve(msg[2]);
      }
    });
    ws.on('error', e => { console.error(`${name}: ws error — ${e.message}`); resolve(false); });
    setTimeout(() => { ws.close(); resolve(false); }, 8000);
  });
}

(async () => {
  for (const a of agents) {
    await publishProfile(a.priv, a.pub, a.name, a.emoji);
  }
  process.exit(0);
})();
