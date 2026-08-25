import fs from 'fs';
import path from 'path';

export function credsPath(name) {
  return path.join(process.cwd(), 'credentials', `${name}.env`);
}

export function readCreds(name) {
  const p = credsPath(name);
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n')
      .filter(l => l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
  );
}

// Merges `updates` into the existing credentials file (creates it if absent).
export function writeCreds(name, updates) {
  const dir = path.join(process.cwd(), 'credentials');
  fs.mkdirSync(dir, { recursive: true });
  const merged = { ...readCreds(name), ...updates };
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  lines.push('');
  fs.writeFileSync(credsPath(name), lines.join('\n'), { mode: 0o600 });
}

export function deleteCreds(name) {
  const p = credsPath(name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// GITHUB_APP_PRIVATE_KEY is stored single-quoted with escaped \n — unwrap to a real PEM.
export function unwrapPem(raw) {
  return (raw ?? '').replace(/^'|'$/g, '').replace(/\\n/g, '\n');
}

// Strips the surrounding quotes only, keeping \n escaped as literal backslash-n
// (for consumers like the Coder template that unescape it themselves).
export function stripQuotes(raw) {
  return (raw ?? '').replace(/^'|'$/g, '');
}
