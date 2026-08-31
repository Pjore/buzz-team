import fs from 'fs';
import path from 'path';
import { readAgentsYaml } from '../agents-yaml.js';
import { getAgentWorkspace } from './common.js';
import { writeRemoteFile, restartAgent } from './soul.js';

// No name -> fan out to every agent in agents.yaml, continuing past per-agent failures.
export function push(name) {
  if (name) {
    pushOne(name);
    return;
  }

  const names = Object.keys(readAgentsYaml());
  const failed = [];
  for (const n of names) {
    try {
      pushOne(n);
    } catch (err) {
      failed.push(n);
      console.error(`  ERROR pushing TEAM.md to ${n}: ${err.message}`);
    }
  }
  const ok = names.length - failed.length;
  console.log(`\nTEAM.md pushed to ${ok}/${names.length} agents` + (failed.length ? ` (failed: ${failed.join(', ')})` : ''));
}

function pushOne(name) {
  const ws = getAgentWorkspace(name);
  const content = readTeamFile();
  writeRemoteFile(name, ws, 'TEAM.md', content);
  restartAgent(name, ws);
  console.log(`  TEAM.md pushed to ${name}`);
}

// Local convention: TEAM.md at the team-instance repo root.
function readTeamFile() {
  const p = path.join(process.cwd(), 'TEAM.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}
