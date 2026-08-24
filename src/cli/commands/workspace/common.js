import fs from 'fs';
import path from 'path';
import { readAgentsYaml } from '../agents-yaml.js';
import { readCreds } from '../credentials.js';
import { checkCoderPrereqs, checkDockerComposePrereqs } from './prereqs.js';
import * as coderBackend from './coder.js';
import * as composeBackend from './docker-compose.js';

export function getAgentWorkspace(name) {
  const agents = readAgentsYaml();
  const agent = agents[name];
  if (!agent) {
    console.error(`ERROR: Agent "${name}" not found in agents.yaml`);
    process.exit(1);
  }
  return agent.workspace ?? {};
}

export function getBackend(ws) {
  return ws.backend === 'docker-compose' ? composeBackend : coderBackend;
}

export function checkPrereqs(ws) {
  if (ws.backend === 'docker-compose') checkDockerComposePrereqs(ws.host);
  else checkCoderPrereqs(ws.template);
}

export function requireCreds(name) {
  const credsPath = path.join(process.cwd(), 'credentials', `${name}.env`);
  if (!fs.existsSync(credsPath)) {
    console.error(`ERROR: credentials/${name}.env not found — run: buzz-team id create ${name} first`);
    process.exit(1);
  }
  return readCreds(name);
}
