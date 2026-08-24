import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// `pkill -x` matches the process name only; `pkill -f buzz-acp` would also match
// this very command line and kill the shell running it. `setsid` puts buzz-acp in
// its own session, and the trailing sleep gives it time to detach — without it the
// ssh session tears down first and takes the process with it.
const RESTART_CMD =
  'pkill -x buzz-acp || true; setsid nohup buzz-acp --agent-command goose --agent-args acp >> /tmp/buzz-acp.log 2>&1 < /dev/null & disown; sleep 2';

export function push(name, ws) {
  const agentsMd = readPersonaFile(name, 'AGENTS.md');
  const soulMd = readPersonaFile(name, 'SOUL.md');

  if (ws.backend === 'docker-compose') {
    writeViaCompose(name, ws, 'AGENTS.md', agentsMd);
    writeViaCompose(name, ws, 'SOUL.md', soulMd);
    execSync(`docker compose -p ${name} restart`, { stdio: 'inherit', env: { ...process.env, DOCKER_HOST: ws.host } });
  } else {
    writeViaSsh(name, 'AGENTS.md', agentsMd);
    writeViaSsh(name, 'SOUL.md', soulMd);
    coderSsh(name, RESTART_CMD);
  }
  console.log(`  Persona pushed to ${name}`);
}

// Local convention (per buzz-team-sv): agents/<name>/AGENTS.md and SOUL.md
function readPersonaFile(name, filename) {
  const p = path.join(process.cwd(), 'agents', name, filename);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

// `--wait no` skips waiting on the startup script, which never completes
// because it backgrounds long-running daemons.
function coderSsh(name, remoteCmd) {
  execSync(`coder ssh --wait no ${shQuote(name)} -- ${shQuote(remoteCmd)}`, { stdio: 'inherit' });
}

function writeViaSsh(name, filename, content) {
  // `coder ssh` allocates a PTY, so content piped over stdin is echoed back and
  // never reaches the remote `cat` as EOF — it hangs. Send it inline as base64.
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  coderSsh(name, `printf %s ${b64} | base64 -d > ~/${filename}`);
}

function shQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function writeViaCompose(name, ws, filename, content) {
  execSync(`docker compose -p ${name} exec -T buzz-agent sh -c 'cat > /root/${filename}'`, {
    input: content,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, DOCKER_HOST: ws.host },
  });
}
