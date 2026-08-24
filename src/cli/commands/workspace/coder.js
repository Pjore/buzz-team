import { execSync } from 'child_process';
import { unwrapPem } from '../credentials.js';

// Parameters that only apply at creation time (coder rejects them on update
// since the template marks them immutable).
const RECREATE_ONLY_PARAMS = ['arch', 'agent_name', 'github_owner'];

function buildParams(name, ws, creds) {
  return {
    arch: ws.arch ?? 'arm64',
    agent_name: name,
    github_owner: creds.BOT_NAME ? creds.BOT_NAME.split('-')[0] : '',
    buzz_relay_url: process.env.BUZZ_RELAY_URL ?? '',
    buzz_private_key: creds.BUZZ_PRIVATE_KEY ?? '',
    github_app_id: creds.GITHUB_APP_ID ?? '',
    github_app_installation_id: creds.GITHUB_APP_INSTALLATION_ID ?? '',
    github_app_private_key: unwrapPem(creds.GITHUB_APP_PRIVATE_KEY),
  };
}

function paramArgs(params, { excludeRecreateOnly = false } = {}) {
  return Object.entries(params)
    .filter(([k]) => !excludeRecreateOnly || !RECREATE_ONLY_PARAMS.includes(k))
    .flatMap(([k, v]) => ['--parameter', `${k}=${v}`]);
}

export function create(name, ws, creds) {
  const args = ['create', name, '--template', ws.template, ...paramArgs(buildParams(name, ws, creds)), '--yes'];
  run(args);
}

export function update(name, ws, creds) {
  const args = ['update', name, ...paramArgs(buildParams(name, ws, creds), { excludeRecreateOnly: true }), '--yes'];
  run(args);
}

export function del(name) {
  run(['delete', name, '--yes']);
}

function run(args) {
  execSync(['coder', ...args].map(shQuote).join(' '), { stdio: 'inherit' });
}

function shQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}
