import { getAgentWorkspace, getBackend, checkPrereqs, requireCreds } from './common.js';
import { push as soulPush } from './soul.js';

export async function update(name, opts = {}) {
  const ws = getAgentWorkspace(name);
  checkPrereqs(ws);

  if (!opts.soulOnly) {
    const creds = requireCreds(name);
    console.log(`Updating workspace: ${name}`);
    getBackend(ws).update(name, ws, creds);
  }

  soulPush(name, ws);
  console.log(`  Workspace ${name} updated`);
}
