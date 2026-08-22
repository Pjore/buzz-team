import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import net from 'net';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { loadConfig } from './config.js';
import { generateKeypair, derivePublicKey } from './nostr.js';
import { publishProfile } from './publish-profile.js';
import { readAgentsYaml } from './agents-yaml.js';

export async function create(name, opts) {
  const config = loadConfig(opts);
  const { GITHUB_TOKEN } = config;

  if (!GITHUB_TOKEN) {
    console.error('ERROR: GITHUB_TOKEN is required (flag --github-token, .env, or env var)');
    process.exit(1);
  }

  // Fail fast, before creating any GitHub App or relay membership.
  const relayUrl = process.env.BUZZ_RELAY_URL;
  if (!relayUrl) {
    console.error('ERROR: BUZZ_RELAY_URL is required — set it in .env or as an environment variable');
    process.exit(1);
  }

  console.log(`Creating agent: ${name}`);

  const githubOwner = await getGithubOwner(GITHUB_TOKEN);
  const botName = `${githubOwner}-${name}[bot]`;
  const botEmail = `${githubOwner}-${name}[bot]@users.noreply.github.com`;

  const credsDir = path.join(process.cwd(), 'credentials');
  const credsPath = path.join(credsDir, `${name}.env`);

  // Load existing credentials if present (resumable create)
  let existingCreds = {};
  if (fs.existsSync(credsPath)) {
    existingCreds = Object.fromEntries(
      fs.readFileSync(credsPath, 'utf8').split('\n')
        .filter(l => l.includes('='))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
    );
    console.log('  Resuming from existing credentials…');
  }

  // 1. Generate or reuse Nostr keypair
  let privkey, pubkey;
  if (existingCreds.BUZZ_PRIVATE_KEY) {
    privkey = existingCreds.BUZZ_PRIVATE_KEY;
    pubkey = derivePublicKey(privkey);
    console.log(`  Nostr pubkey (existing): ${pubkey}`);
  } else {
    ({ privkey, pubkey } = generateKeypair());
    console.log(`  Nostr pubkey: ${pubkey}`);
  }

  // 2. Create GitHub App via manifest flow (skip if already created)
  let appCreds;
  if (existingCreds.GITHUB_APP_ID && existingCreds.GITHUB_APP_INSTALLATION_ID && existingCreds.GITHUB_APP_PRIVATE_KEY) {
    appCreds = {
      app_id: existingCreds.GITHUB_APP_ID,
      installation_id: existingCreds.GITHUB_APP_INSTALLATION_ID,
      pem: existingCreds.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    console.log(`  GitHub App ID (existing): ${appCreds.app_id}`);
  } else {
    console.log('  Launching GitHub App manifest flow…');
    appCreds = await createGitHubApp(name, GITHUB_TOKEN);
    console.log(`  GitHub App ID: ${appCreds.app_id}`);
    console.log(`  GitHub App Installation ID: ${appCreds.installation_id}`);
  }

  // 3. Persist credentials now — the keypair and GitHub App already exist at this
  // point (real, hard-to-reverse side effects), so a later failure (relay/profile)
  // must not force a recreate on retry and lose the App's private key.
  const agents = readAgentsYaml();
  const agentDef = agents[name] ?? {};
  const agentEnv = agentDef.env ?? {};

  fs.mkdirSync(credsDir, { recursive: true });
  const pemEscaped = appCreds.pem.replace(/\n/g, '\\n');

  const credLines = [
    `BUZZ_PRIVATE_KEY=${privkey}`,
    `GITHUB_APP_ID=${appCreds.app_id}`,
    `GITHUB_APP_INSTALLATION_ID=${appCreds.installation_id}`,
    `GITHUB_APP_PRIVATE_KEY='${pemEscaped}'`,
    `BOT_NAME=${botName}`,
    `BOT_EMAIL=${botEmail}`,
  ];

  for (const [key, val] of Object.entries(agentEnv)) {
    credLines.push(`${key}=${val}`);
  }
  credLines.push('');

  fs.writeFileSync(credsPath, credLines.join('\n'), { mode: 0o600 });
  console.log(`  Credentials written to: credentials/${name}.env`);

  // 4. Enroll pubkey in relay
  if (config.BUZZ_RELAY_SSH) {
    console.log('  Enrolling pubkey in relay…');
    enrollInRelay(config.BUZZ_RELAY_SSH, pubkey, config.BUZZ_RELAY_SSH_KEY);
    console.log('  Relay enrollment done');
  } else {
    console.log('  WARN: BUZZ_RELAY_SSH not set — skipping relay enrollment');
  }

  // 5. Publish Nostr profile
  console.log(`  Publishing Nostr profile to ${relayUrl}…`);
  await publishProfile(privkey, pubkey, name.charAt(0).toUpperCase() + name.slice(1), '🤖', relayUrl);

  console.log(`\nCredentials: credentials/${name}.env`);

  const CREDENTIAL_SUFFIXES = ['_TOKEN', '_KEY', '_SECRET', '_API_KEY'];
  const hasCredentials = Object.keys(agentEnv).some(k =>
    CREDENTIAL_SUFFIXES.some(s => k.toUpperCase().endsWith(s))
  );
  if (!hasCredentials) {
    console.log(`\n⚠  AI provider auth not configured.`);
    console.log(`   Run: buzz-team auth ${name}`);
  }

  console.log('\nTo start this agent with docker compose:');
  console.log(`  cp credentials/${name}.env compose/.env && docker compose -f compose/docker-compose.yml up -d`);
}

// ---------------------------------------------------------------------------
// GitHub App manifest flow
// ---------------------------------------------------------------------------
function createGitHubApp(agentName, githubToken) {
  return new Promise(async (resolve, reject) => {
    const githubOwner = await getGithubOwner(githubToken);
    const appName = `${githubOwner}-${agentName}`;
    const state = crypto.randomBytes(16).toString('hex');
    const port = await getFreePort();
    const callbackUrl = `http://localhost:${port}/callback`;
    const installedUrl = `http://localhost:${port}/installed`;

    const manifest = {
      name: appName,
      url: `https://github.com/${githubOwner}`,
      description: `Buzz agent identity for ${agentName}`,
      public: false,
      redirect_url: callbackUrl,
      setup_url: installedUrl,
      setup_on_update: false,
      hook_attributes: { url: 'https://example.com/webhook', active: false },
      default_permissions: {
        contents: 'write',
        pull_requests: 'write',
        issues: 'write',
        metadata: 'read',
      },
      default_events: ['push', 'pull_request', 'issues'],
    };

    let credentials = null;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);

      if (url.pathname === '/') {
        const manifestJson = JSON.stringify(manifest).replace(/"/g, '&quot;');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><body>
<h2>Creating GitHub App: ${appName}</h2>
<form id="f" action="https://github.com/settings/apps/new?state=${state}" method="post">
  <input type="hidden" name="manifest" value="${manifestJson}">
</form>
<script>document.getElementById('f').submit();</script>
</body></html>`);
        return;
      }

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        if (url.searchParams.get('state') !== state) {
          res.end('State mismatch'); server.close(); reject(new Error('CSRF')); return;
        }
        try { credentials = await exchangeCode(code); }
        catch (e) { res.end(e.message); server.close(); reject(e); return; }
        const installUrl = `https://github.com/settings/apps/${credentials.slug}/installations`;
        res.writeHead(302, { Location: installUrl });
        res.end();
        return;
      }

      if (url.pathname === '/installed') {
        const installationId = url.searchParams.get('installation_id');
        if (!installationId || !credentials) {
          res.end('Missing data'); server.close(); reject(new Error('Missing installation_id')); return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Done! You can close this tab.</h2></body></html>');
        server.close();
        resolve({ app_id: String(credentials.id), pem: credentials.pem, installation_id: installationId });
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${port}/`;
      console.log(`  Open in browser: ${url}`);
      try { execSync(`"$BROWSER" "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || open "${url}"`, { stdio: 'ignore', shell: true }); }
      catch { /* browser open is best-effort */ }
    });
  });
}

function exchangeCode(code) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/app-manifests/${code}/conversions`,
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'buzz-team-cli/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Length': 0,
      },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const p = JSON.parse(d);
        if (p.id) resolve(p); else reject(new Error(`Conversion failed: ${d}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function enrollInRelay(relaySsh, pubkey, sshKey) {
  const keyArg = sshKey ? `-i ${sshKey} ` : '';
  const cmd = `ssh ${keyArg}-o StrictHostKeyChecking=no ${relaySsh} 'docker exec $(docker ps --filter name=-relay- --format "{{.ID}}" | head -1) buzz-admin add-member --pubkey ${pubkey} --role member'`;
  execSync(cmd, { stdio: 'inherit' });
}

function getGithubOwner(token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/user',
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'buzz-team-cli/1.0', Accept: 'application/vnd.github+json' },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const p = JSON.parse(d);
        if (p.login) resolve(p.login); else reject(new Error(`Could not get GitHub owner: ${d}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getFreePort() {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
  });
}
