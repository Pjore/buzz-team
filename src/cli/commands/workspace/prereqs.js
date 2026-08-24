import { execSync } from 'child_process';

export function checkCoderPrereqs(template) {
  try { execSync('command -v coder', { stdio: 'ignore' }); }
  catch { fail('coder CLI not found on PATH'); }

  try { execSync('coder whoami', { stdio: 'ignore' }); }
  catch { fail('coder CLI not authenticated — run: coder login <url>'); }

  try {
    const out = execSync('coder templates list', { encoding: 'utf8' });
    if (!out.includes(template)) throw new Error('not found');
  } catch {
    fail(`template "${template}" not found — run: coder templates push ${template}`);
  }
}

export function checkDockerComposePrereqs(host) {
  try { execSync('command -v docker', { stdio: 'ignore' }); }
  catch { fail('docker CLI not found on PATH'); }

  try {
    execSync('docker info', { stdio: 'ignore', env: { ...process.env, DOCKER_HOST: host } });
  } catch {
    fail(`docker daemon not reachable at ${host}`);
  }
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
