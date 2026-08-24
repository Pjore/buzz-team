import { getAgentWorkspace, getBackend, checkPrereqs } from './common.js';

export async function del(name) {
  const ws = getAgentWorkspace(name);
  checkPrereqs(ws);

  console.log(`Deleting workspace: ${name}`);
  getBackend(ws).del(name, ws);
  console.log(`  Workspace ${name} deleted`);
}
