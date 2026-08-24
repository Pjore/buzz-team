import { getAgentWorkspace, getBackend, checkPrereqs, requireCreds } from './common.js';
import { push as soulPush } from './soul.js';

export async function create(name) {
  const ws = getAgentWorkspace(name);
  const creds = requireCreds(name);
  checkPrereqs(ws);

  console.log(`Creating workspace: ${name} (backend: ${ws.backend ?? 'coder'})`);
  getBackend(ws).create(name, ws, creds);
  soulPush(name, ws);
  console.log(`  Workspace ${name} created`);
}
