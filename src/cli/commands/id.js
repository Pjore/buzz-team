import { readCreds, deleteCreds, unwrapPem } from './credentials.js';
import { uninstallGitHubApp } from './github.js';
import * as key from './key.js';
import * as app from './app.js';
import * as community from './community.js';
import * as profile from './profile.js';

export async function create(name, opts = {}) {
  console.log(`Creating agent: ${name}`);

  await key.create(name);
  await app.create(name, opts);
  await community.join(name, opts);
  await profile.publish(name);

  const CREDENTIAL_SUFFIXES = ['_TOKEN', '_KEY', '_SECRET', '_API_KEY'];
  const creds = readCreds(name);
  const hasCredentials = Object.keys(creds).some(k =>
    !['BUZZ_PRIVATE_KEY', 'GITHUB_APP_PRIVATE_KEY'].includes(k) && CREDENTIAL_SUFFIXES.some(s => k.toUpperCase().endsWith(s))
  );

  console.log(`\nCredentials: credentials/${name}.env`);
  if (!hasCredentials) {
    console.log(`\n⚠  AI provider auth not configured.`);
    console.log(`   Run: buzz-team auth ${name}`);
  }
  console.log('\nTo start this agent with docker compose:');
  console.log(`  cp credentials/${name}.env compose/.env && docker compose -f compose/docker-compose.yml up -d`);
}

export async function del(name, opts = {}) {
  const creds = readCreds(name);
  if (!creds.GITHUB_APP_ID) {
    console.error(`ERROR: credentials/${name}.env not found`);
    process.exit(1);
  }

  console.log(`Deleting agent: ${name} (App ID: ${creds.GITHUB_APP_ID})`);

  const pem = unwrapPem(creds.GITHUB_APP_PRIVATE_KEY);
  const alreadyUninstalled = await uninstallGitHubApp(creds.GITHUB_APP_ID, creds.GITHUB_APP_INSTALLATION_ID, pem);
  console.log(alreadyUninstalled
    ? `  Installation ${creds.GITHUB_APP_INSTALLATION_ID} already uninstalled`
    : `  Installation ${creds.GITHUB_APP_INSTALLATION_ID} uninstalled`);

  await community.leave(name, opts);

  deleteCreds(name);
  console.log(`  credentials/${name}.env removed`);
  console.log(`\nNOTE: GitHub has no API to delete the App registration itself (App ID ${creds.GITHUB_APP_ID}).`);
  console.log(`  Remove it manually at https://github.com/settings/apps under Settings > Developer settings > GitHub Apps.`);
}
