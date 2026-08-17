# AGENTS.md — buzz-team

## What this repo is

Tooling for building, provisioning, and running AI agents on a Nostr-based relay (Buzz ACP). Three artifacts:

1. **Docker images** — `buzz-team-agent-base` (debian:trixie-slim) and `buzz-team-agent-coder` (codercom/enterprise-base)
2. **Coder template** — `coder/templates/buzz-agent/main.tf`
3. **CLI** — `src/cli/` npm package (`buzz-team init|create|update|delete`)

## Key constraints

- All images are `linux/arm64` first. Never break ARM; add `linux/amd64` later.
- No tmux, no supervisord. Process model: `tini → entrypoint.sh → token-refresh.sh & → exec buzz-acp`
- `GITHUB_APP_PRIVATE_KEY` uses literal `\n` (not real newlines). The entrypoint expands them with `printf '%b'`.
- `src/agents.yaml`, `credentials/`, and `.env` are always gitignored. Ship only `.example` variants.
- Images do not ship default persona files. Persona is injected via `AGENTS_MD` / `SOUL_MD` env vars at runtime.

## CLI development

Run directly without installing:
```
node src/cli/bin/buzz-team.js <command>
```

The `defaults/` dir is at `src/defaults/` (not `src/cli/defaults/`). The `__dirname` in `init.js` resolves two levels up from `commands/`.

`@noble/secp256k1` v2 does not export `bytesToHex`/`hexToBytes` — use `Buffer.from(bytes).toString('hex')` and `Buffer.from(hex, 'hex')`.

Profile publishing (`src/cli/commands/publish-profile.js`) requires `nostr-tools` and `ws` globally installed. If absent it warns and continues.

## E2e test workflow

```bash
# 1. Build base image locally
docker build -t buzz-team-agent-base:local images/base/

# 2. Init a test workspace
mkdir -p /tmp/test-agent && cd /tmp/test-agent
GITHUB_TOKEN=$(gh auth token) \
BUZZ_RELAY_SSH=$BUZZ_RELAY_SSH \
BUZZ_RELAY_SSH_KEY=$BUZZ_RELAY_SSH_KEY \
  node /path/to/buzz-team/src/cli/bin/buzz-team.js init

# 3. Create an agent
node .../buzz-team.js create <name>

# 4. Run the container
docker run -d --name <name>-test --env-file run.env buzz-team-agent-base:local
docker logs <name>-test   # expect: "connected to relay at wss://..."
```

## Relay facts

- Relay URL: `$BUZZ_RELAY_URL`
- SSH host: `$BUZZ_RELAY_SSH` (key at `$BUZZ_RELAY_SSH_KEY`)
- Container filter: `docker ps --filter name=-relay-` matches `compose-<stack>-relay-1`
- Enrollment: `buzz-admin add-member --pubkey <hex> --role member`

## When making changes

- Entrypoint and token-refresh changes require rebuilding the image to test.
- CLI changes can be tested immediately with `node src/cli/bin/buzz-team.js`.
- Commit fixes to the `feat/implement-buzz-team` branch and push — CI will rebuild images on merge to main.
