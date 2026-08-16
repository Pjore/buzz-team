# buzz-team

A self-contained project for building, provisioning, and running AI agents that communicate over a Nostr-based relay using the Buzz ACP protocol.

## Language

### Agent model

**buzz-team-agent**:
A 1:1 pairing of an identity and a workspace. The indivisible unit of the system — one soul, one body.
_Avoid_: agent, buzz agent, bot

**identity**:
The credentials that make a buzz-team-agent unique: a Nostr keypair and a GitHub App (app ID, installation ID, PEM private key). Always runtime-injected; never baked into an image.
_Avoid_: credentials (too generic), secrets

**workspace**:
An isolated container or VPS where one buzz-team-agent runs. Hosts the harness, persona files, and the token-refresh loop.
_Avoid_: environment, instance, box

**harness**:
The AI runner inside the workspace that processes Buzz ACP messages. Currently only `goose`.
_Avoid_: agent runner, AI backend, engine

**persona**:
The content of `AGENTS.md` and `SOUL.md` in the workspace filesystem. Defines the agent's instructions and character. Written by the operator; defaults shipped in the image.
_Avoid_: system prompt, config

### Images

**buzz-team-agent-base**:
The ARM64 Docker image (`ghcr.io/pjore/buzz-team-agent-base`) containing all runtime deps: tini, Node.js, gh CLI, goose, sprig. Floor is `debian:trixie-slim`. Used directly for basic docker-compose deployments and as a binary source for the Coder image.
_Avoid_: base image (without qualifier)

**buzz-team-agent-coder**:
ARM64 Docker image (`ghcr.io/pjore/buzz-team-agent-coder`) that floors on `codercom/enterprise-base:ubuntu`. Extracts pre-built binaries (sprig, goose, entrypoint scripts) from `buzz-team-agent-base` at build time via multi-stage `COPY --from`. Used as the container image in the Coder template.
_Avoid_: coder image (without qualifier)

**sprig**:
The multi-call binary that provides the `buzz-acp` and `buzz` entrypoints. Copied from `ghcr.io/pjore/buzz-sprig` at image build time.
_Avoid_: buzz-acp binary, buzz binary

### Runtime behaviour

**token-refresh loop**:
A background bash process (`&`) started by the entrypoint before `exec buzz-acp`. Mints a fresh GitHub App installation token every 50 minutes and reconfigures git and gh credentials.
_Avoid_: token daemon, refresh daemon, token watcher

**minting**:
The act of exchanging a GitHub App's private key and installation ID for a short-lived installation access token via the GitHub API. The only authentication flow used in both images.
_Avoid_: token generation, token fetch, device code flow

### Tooling and configuration

**buzz-team CLI**:
The npm package (command: `buzz-team`) that operators run on their host machine to provision and manage buzz-team-agents. Provides `init`, `create`, `update`, `delete`.
_Avoid_: management scripts, manage-agents, CLI tool

**team config**:
The local directory containing `agents.yaml`, per-agent persona files, and `.env`. Always gitignored. Scaffolded by `buzz-team init`.
_Avoid_: project config, workspace config

**credentials**:
Per-agent file `credentials/<name>.env` written by `buzz-team create`. Contains identity values for one agent.
_Avoid_: secrets file, env file (too generic)

**relay**:
The Buzz Nostr relay server. Agents are enrolled by `buzz-team create` via SSH. Address supplied as `BUZZ_RELAY_URL`.
_Avoid_: Nostr relay (when speaking within this project's context)
