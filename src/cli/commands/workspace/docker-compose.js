import { execSync } from 'child_process';

export function create(name, ws) {
  run(ws, `docker compose -p ${name} --env-file credentials/${name}.env -f compose/docker-compose.yml up -d`);
}

export function update(name, ws) {
  create(name, ws);
}

export function del(name, ws) {
  run(ws, `docker compose -p ${name} --env-file credentials/${name}.env -f compose/docker-compose.yml down -v`);
}

function run(ws, cmd) {
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, DOCKER_HOST: ws.host } });
}
