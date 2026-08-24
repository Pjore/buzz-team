import { getAgentWorkspace } from './common.js';
import { push as soulPushImpl } from './soul.js';

export async function push(name) {
  const ws = getAgentWorkspace(name);
  soulPushImpl(name, ws);
}
