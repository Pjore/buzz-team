import { getAgentWorkspace, getBackend, checkPrereqs, requireCreds } from './common.js';
import { push as soulPush } from './soul.js';
import { push as teamPush } from './team.js';

export async function create(name) {
  const ws = getAgentWorkspace(name);
  const creds = requireCreds(name);
  checkPrereqs(ws);

  console.log(`Creating workspace: ${name} (backend: ${ws.backend ?? 'coder'})`);
  getBackend(ws).create(name, ws, creds);
  soulPush(name, ws);
  teamPush(name);
  console.log(`  Workspace ${name} created`);
}
