import fs from 'fs';
import path from 'path';
import https from 'https';
import { loadConfig } from './config.js';
import { readAgentsYaml } from './agents-yaml.js';

export async function update(name, opts) {
  const config = loadConfig(opts);
  const { GITHUB_TOKEN } = config;

  if (!GITHUB_TOKEN) {
    console.error('ERROR: GITHUB_TOKEN is required');
    process.exit(1);
  }

  const agents = readAgentsYaml();
  const agent = agents[name];
  if (!agent) {
    console.error(`ERROR: Agent "${name}" not found in agents.yaml`);
    process.exit(1);
  }

  const credsPath = path.join(process.cwd(), 'credentials', `${name}.env`);
  if (!fs.existsSync(credsPath)) {
    console.error(`ERROR: credentials/${name}.env not found — run buzz-team create ${name} first`);
    process.exit(1);
  }

  const creds = Object.fromEntries(
    fs.readFileSync(credsPath, 'utf8').split('\n')
      .filter(l => l.includes('='))
      .map(l => l.split('=', 2))
  );

  console.log(`Updating agent: ${name} (App ID: ${creds.GITHUB_APP_ID})`);

  const installationId = creds.GITHUB_APP_INSTALLATION_ID;
  const repos = (agent.repos ?? []).map(r => r.split('/')[1]);

  if (repos.length === 0) {
    console.log('  No repos configured in agents.yaml — nothing to update');
    return;
  }

  await addReposToInstallation(creds.GITHUB_APP_ID, installationId, agent.repos, GITHUB_TOKEN);
  console.log(`  Synced ${repos.length} repo(s) to installation`);
}

function addReposToInstallation(appId, installationId, repos, token) {
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
