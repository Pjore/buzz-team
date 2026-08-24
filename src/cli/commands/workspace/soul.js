import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const RESTART_CMD = "pkill -f buzz-acp || true; nohup buzz-acp --agent-command goose --agent-args acp >> /tmp/buzz-acp.log 2>&1 & disown";

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
    execSync(`coder ssh ${name} -- '${RESTART_CMD}'`, { stdio: 'inherit' });
  }
  console.log(`  Persona pushed to ${name}`);
}

// Local convention (per buzz-team-sv): agents/<name>/AGENTS.md and SOUL.md
function readPersonaFile(name, filename) {
  const p = path.join(process.cwd(), 'agents', name, filename);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function writeViaSsh(name, filename, content) {
  execSync(`coder ssh ${name} -- 'cat > ~/${filename}'`, { input: content, stdio: ['pipe', 'inherit', 'inherit'] });
}

function writeViaCompose(name, ws, filename, content) {
  execSync(`docker compose -p ${name} exec -T buzz-agent sh -c 'cat > /root/${filename}'`, {
    input: content,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, DOCKER_HOST: ws.host },
  });
}
