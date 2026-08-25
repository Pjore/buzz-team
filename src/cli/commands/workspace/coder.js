import { execSync } from 'child_process';
import { stripQuotes } from '../credentials.js';

// Parameters coder accepts on an existing workspace. Everything else is
// `mutable = false` in coder/templates/buzz-team-agent/main.tf, and passing an
// immutable parameter to `coder restart --always-prompt` is a hard error.
const MUTABLE_PARAMS = ['buzz_relay_url', 'preview_ports'];

function buildParams(name, ws, creds) {
  if (!process.env.BUZZ_RELAY_URL) {
    console.error('ERROR: BUZZ_RELAY_URL is not set — add it to .env or the environment');
    process.exit(1);
  }
  return {
    arch: ws.arch ?? 'arm64',
    agent_name: name,
    github_owner: creds.BOT_NAME ? creds.BOT_NAME.split('-')[0] : '',
    buzz_relay_url: process.env.BUZZ_RELAY_URL,
    buzz_private_key: creds.BUZZ_PRIVATE_KEY ?? '',
    github_app_id: creds.GITHUB_APP_ID ?? '',
    github_app_installation_id: creds.GITHUB_APP_INSTALLATION_ID ?? '',
    // Kept as literal `\n` — the Terraform template unwraps it itself
    // (see main.tf's coder_agent startup_script and entrypoint.sh).
    github_app_private_key: stripQuotes(creds.GITHUB_APP_PRIVATE_KEY),
    preview_ports: ws.preview_ports ?? '',
  };
}

function paramArgs(params, { mutableOnly = false } = {}) {
  return Object.entries(params)
    .filter(([k]) => !mutableOnly || MUTABLE_PARAMS.includes(k))
    .flatMap(([k, v]) => ['--parameter', `${k}=${v}`]);
}

export function create(name, ws, creds) {
  const args = ['create', name, '--template', ws.template, ...paramArgs(buildParams(name, ws, creds)), '--yes'];
  run(args);
}

export function update(name, ws, creds) {
  // `coder update` is a no-op unless the template version changed, and plain
  // `coder restart --parameter` silently reuses the existing build's values.
  // `--always-prompt` is what makes the supplied values actually take effect.
  const args = [
    'restart',
    name,
    '--always-prompt',
    ...paramArgs(buildParams(name, ws, creds), { mutableOnly: true }),
    '--yes',
  ];
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
