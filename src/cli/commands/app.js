import { loadConfig } from './config.js';
import { readAgentsYaml } from './agents-yaml.js';
import { readCreds, writeCreds, unwrapPem } from './credentials.js';
import { getGithubOwner, createGitHubApp, addReposToInstallation } from './github.js';

export async function create(name, opts = {}) {
  const config = loadConfig(opts);
  const { GITHUB_TOKEN } = config;
  if (!GITHUB_TOKEN) {
    console.error('ERROR: GITHUB_TOKEN is required (flag --github-token, .env, or env var)');
    process.exit(1);
  }

  const existing = readCreds(name);
  if (existing.GITHUB_APP_ID && existing.GITHUB_APP_INSTALLATION_ID && existing.GITHUB_APP_PRIVATE_KEY) {
    console.log(`  GitHub App ID (existing): ${existing.GITHUB_APP_ID}`);
    return { app_id: existing.GITHUB_APP_ID, installation_id: existing.GITHUB_APP_INSTALLATION_ID, pem: unwrapPem(existing.GITHUB_APP_PRIVATE_KEY) };
  }

  const githubOwner = await getGithubOwner(GITHUB_TOKEN);
  const botName = `${githubOwner}-${name}[bot]`;
  const botEmail = `${githubOwner}-${name}[bot]@users.noreply.github.com`;

  console.log('  Launching GitHub App manifest flow…');
  const appCreds = await createGitHubApp(name, GITHUB_TOKEN);
  console.log(`  GitHub App ID: ${appCreds.app_id}`);
  console.log(`  GitHub App Installation ID: ${appCreds.installation_id}`);

  const pemEscaped = appCreds.pem.replace(/\n/g, '\\n');
  writeCreds(name, {
    GITHUB_APP_ID: appCreds.app_id,
    GITHUB_APP_INSTALLATION_ID: appCreds.installation_id,
    GITHUB_APP_PRIVATE_KEY: `'${pemEscaped}'`,
    BOT_NAME: botName,
    BOT_EMAIL: botEmail,
  });
  console.log(`  Credentials written to: credentials/${name}.env`);
  return appCreds;
}

export async function update(name, opts = {}) {
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

  const creds = readCreds(name);
  if (!creds.GITHUB_APP_INSTALLATION_ID) {
    console.error(`ERROR: credentials/${name}.env not found — run: buzz-team app create ${name} first`);
    process.exit(1);
  }

  console.log(`Updating agent: ${name} (App ID: ${creds.GITHUB_APP_ID})`);

  const repos = agent.repos ?? [];
  if (repos.length === 0) {
    console.log('  No repos configured in agents.yaml — nothing to update');
    return;
  }

  await addReposToInstallation(creds.GITHUB_APP_INSTALLATION_ID, repos, GITHUB_TOKEN);
  console.log(`  Synced ${repos.length} repo(s) to installation`);
}
