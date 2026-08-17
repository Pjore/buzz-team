import { execSync } from 'child_process';
import { loadConfig } from './config.js';
import { readAgentsYaml } from './agents-yaml.js';

// Configure commands per harness — run interactively inside the container
const HARNESS_CONFIGURE = {
  goose: 'goose configure',
  codex: 'codex login',
};

export function auth(name, opts) {
  const config = loadConfig(opts);
  const agents = readAgentsYaml();
  const agentDef = agents[name];

  if (!agentDef) {
    console.error(`ERROR: Agent "${name}" not found in agents.yaml`);
    process.exit(1);
  }

  const harness = agentDef.harness ?? 'goose';
  const configureCmd = HARNESS_CONFIGURE[harness];
  if (!configureCmd) {
    console.error(`ERROR: No configure command known for harness "${harness}"`);
    process.exit(1);
  }

  // --ssh overrides agents.yaml ssh field; relay-ssh falls back for Docker hosts
  const directSsh = opts.ssh || agentDef.ssh;
  const relaySsh = opts.relaySsh || config.BUZZ_RELAY_SSH;
  const sshKey = opts.sshKey || config.BUZZ_RELAY_SSH_KEY;

  if (directSsh) {
    // Arbitrary SSH host — run configure command directly (e.g. Coder workspace)
    const sshKeyFlag = sshKey ? `-i "${sshKey}"` : '';
    console.log(`Running "${configureCmd}" on ${directSsh}…`);
    execSync(
      `ssh -t ${sshKeyFlag} -o StrictHostKeyChecking=no ${directSsh} "${configureCmd}"`,
      { stdio: 'inherit' }
    );
    return;
  }

  if (!relaySsh) {
    // Local Docker — find container by name and exec directly
    const container = findLocalContainer(name);
    console.log(`Running "${configureCmd}" in local container ${container}…`);
    execSync(`docker exec -it ${container} ${configureCmd}`, { stdio: 'inherit' });
    return;
  }

  // Remote relay host via SSH + Docker exec
  const sshKeyFlag = sshKey ? `-i "${sshKey}"` : '';
  const findCmd = `docker ps --filter name=${name} --filter status=running -q | head -1`;
  const containerId = execSync(
    `ssh ${sshKeyFlag} -o StrictHostKeyChecking=no ${relaySsh} "${findCmd}"`,
    { encoding: 'utf8' }
  ).trim();

  if (!containerId) {
    console.error(`ERROR: No running container matching "${name}" found on ${relaySsh}`);
    process.exit(1);
  }

  console.log(`Found container: ${containerId}`);
  console.log(`Running "${configureCmd}" — follow the prompts in your browser`);

  execSync(
    `ssh -t ${sshKeyFlag} -o StrictHostKeyChecking=no ${relaySsh} "docker exec -it ${containerId} ${configureCmd}"`,
    { stdio: 'inherit' }
  );
}

function findLocalContainer(name) {
  const id = execSync(
    `docker ps --filter name=${name} --filter status=running -q | head -1`,
    { encoding: 'utf8' }
  ).trim();
  if (!id) {
    console.error(`ERROR: No running local container matching "${name}"`);
    process.exit(1);
  }
  return id;
}
