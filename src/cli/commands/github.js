import https from 'https';
import http from 'http';
import net from 'net';
import crypto from 'crypto';
import { execSync } from 'child_process';

export function getGithubOwner(token) {
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

// ---------------------------------------------------------------------------
// GitHub App manifest flow
// ---------------------------------------------------------------------------
export function createGitHubApp(agentName, githubToken) {
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

function getFreePort() {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
  });
}

export function addReposToInstallation(installationId, repos, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ repositories: repos.map(r => r.split('/')[1]) });
    const opts = {
      hostname: 'api.github.com',
      path: `/user/installations/${installationId}/repositories`,
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'buzz-team-cli/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`GitHub API error ${res.statusCode}: ${d}`));
        else resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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

export function uninstallGitHubApp(appId, installationId, privateKeyPem) {
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
