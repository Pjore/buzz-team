import { push as teamPushImpl } from './team.js';

export async function push(name) {
  teamPushImpl(name);
}
