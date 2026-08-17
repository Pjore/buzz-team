import fs from 'fs';
import path from 'path';
import https from 'https';
import { loadConfig } from './config.js';

export async function del(name, opts) {
  const config = loadConfig(opts);
  const { GITHUB_TOKEN } = config;

  if (!GITHUB_TOKEN) {
    console.error('ERROR: GITHUB_TOKEN is required');
    process.exit(1);
  }

  const credsPath = path.join(process.cwd(), 'credentials', `${name}.env`);
  if (!fs.existsSync(credsPath)) {
    console.error(`ERROR: credentials/${name}.env not found`);
    process.exit(1);
  }

  const creds = Object.fromEntries(
    fs.readFileSync(credsPath, 'utf8').split('\n')
      .filter(l => l.includes('='))
      .map(l => l.split('=', 2))
  );

  const appId = creds.GITHUB_APP_ID;
  console.log(`Deleting agent: ${name} (App ID: ${appId})`);

  await deleteGitHubApp(appId, GITHUB_TOKEN);
  fs.unlinkSync(credsPath);
  console.log(`  GitHub App ${appId} deleted`);
  console.log(`  credentials/${name}.env removed`);
}

function deleteGitHubApp(appId, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/apps/${appId}`,
      method: 'DELETE',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'buzz-team-cli/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };
    https.request(opts, res => {
      res.resume();
      res.on('end', () => {
        if (res.statusCode === 204) resolve();
        else reject(new Error(`GitHub API error ${res.statusCode}`));
      });
    }).on('error', reject).end();
  });
}
