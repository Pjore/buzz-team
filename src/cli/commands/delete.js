import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { loadConfig } from './config.js';
import { derivePublicKey } from './nostr.js';

export async function del(name, opts) {
  const config = loadConfig(opts);

  const credsPath = path.join(process.cwd(), 'credentials', `${name}.env`);
  if (!fs.existsSync(credsPath)) {
    console.error(`ERROR: credentials/${name}.env not found`);
    process.exit(1);
  }

  const creds = Object.fromEntries(
    fs.readFileSync(credsPath, 'utf8').split('\n')
      .filter(l => l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
  );

  const appId = creds.GITHUB_APP_ID;
  const installationId = creds.GITHUB_APP_INSTALLATION_ID;
  const privateKey = creds.GITHUB_APP_PRIVATE_KEY.replace(/^'|'$/g, '').replace(/\\n/g, '\n');
  const pubkey = derivePublicKey(creds.BUZZ_PRIVATE_KEY);
  console.log(`Deleting agent: ${name} (App ID: ${appId})`);

  const alreadyUninstalled = await uninstallGitHubApp(appId, installationId, privateKey);
  console.log(alreadyUninstalled ? `  Installation ${installationId} already uninstalled` : `  Installation ${installationId} uninstalled`);

  if (config.BUZZ_RELAY_SSH) {
    removeFromRelay(config.BUZZ_RELAY_SSH, pubkey, config.BUZZ_RELAY_SSH_KEY);
    console.log(`  Relay membership removed (profile is kept)`);
  } else {
    console.log('  WARN: BUZZ_RELAY_SSH not set — skipping relay membership removal');
  }

  fs.unlinkSync(credsPath);
  console.log(`  credentials/${name}.env removed`);
  console.log(`\nNOTE: GitHub has no API to delete the App registration itself (App ID ${appId}).`);
  console.log(`  Remove it manually at https://github.com/settings/apps under Settings > Developer settings > GitHub Apps.`);
}

function removeFromRelay(relaySsh, pubkey, sshKey) {
  const keyArg = sshKey ? `-i ${sshKey} ` : '';
  const cmd = `ssh ${keyArg}-o StrictHostKeyChecking=no ${relaySsh} 'docker exec $(docker ps --filter name=-relay- --format "{{.ID}}" | head -1) buzz-admin remove-member --pubkey ${pubkey}'`;
  execSync(cmd, { stdio: 'inherit' });
}

// GitHub App installations can only be uninstalled while authenticated as the
// app itself (JWT signed with its private key) — a user token cannot do this,
// and there is no REST endpoint to delete the App registration at all.
function mintAppJwt(appId, privateKeyPem) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })).toString('base64url');
  const sig = crypto.createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key, 'base64url');
  return `${header}.${payload}.${sig}`;
}

function uninstallGitHubApp(appId, installationId, privateKeyPem) {
  return new Promise((resolve, reject) => {
    const jwt = mintAppJwt(appId, privateKeyPem);
    const opts = {
      hostname: 'api.github.com',
      path: `/app/installations/${installationId}`,
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'buzz-team-cli/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };
    https.request(opts, res => {
      res.resume();
      res.on('end', () => {
        if (res.statusCode === 202 || res.statusCode === 204) resolve(false);
        else if (res.statusCode === 404) resolve(true); // already uninstalled
        else reject(new Error(`GitHub API error ${res.statusCode}`));
      });
    }).on('error', reject).end();
  });
}
