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
The AI runner inside the workspace that processes Buzz ACP messages. Examples: `goose`, `codex`.
_Avoid_: agent runner, AI backend, engine

**provider**:
The AI model service configured within a harness. Examples: `github_copilot`, `anthropic`, `openai`. A harness may support multiple providers; the active one is selected via harness-native environment variables (e.g. `GOOSE_PROVIDER`). Distinct from the agent's GitHub identity.
_Avoid_: AI provider (when the harness is already established), model backend

**persona**:
The content of `AGENTS.md` and `SOUL.md` in the workspace filesystem. Defines the agent's instructions and character. Written by the operator; defaults shipped in the image.
_Avoid_: system prompt, config

**team charter**:
The content of `TEAM.md` in the workspace filesystem. Shared across every buzz-team-agent on a team — team member roster and team-wide rules (e.g. the mentions-gate, workspace isolation). Distinct from **persona** (per-agent, one file per agent) and **team config** (provisioning data, not content). Referenced by name from `AGENTS.md`, since a harness's context-loading config only points at `AGENTS.md` and is never modified per-team. Defaults shipped in `buzz-team`'s `TEAM.md` template; the operator edits the roster and any team-specific rules.
_Avoid_: shared persona, root AGENTS.md, team AGENTS.md

### Images

**buzz-team-agent-base**:
The ARM64 Docker image (`ghcr.io/<owner>/buzz-team-agent-base`) containing all runtime deps: tini, Node.js, gh CLI, goose, sprig. Floor is `debian:trixie-slim`. Used directly for basic docker-compose deployments and as a binary source for the Coder image.
_Avoid_: base image (without qualifier)

**buzz-team-agent-coder**:
ARM64 Docker image (`ghcr.io/<owner>/buzz-team-agent-coder`) that floors on `codercom/enterprise-base:ubuntu`. Extracts pre-built binaries (sprig, goose, entrypoint scripts) from `buzz-team-agent-base` at build time via multi-stage `COPY --from`. Used as the container image in the Coder template.
_Avoid_: coder image (without qualifier)

**sprig**:
The multi-call binary that provides the `buzz-acp` and `buzz` entrypoints. Copied from `ghcr.io/<owner>/buzz-sprig` at image build time.
_Avoid_: buzz-acp binary, buzz binary

### Runtime behaviour

**token-refresh loop**:
A background bash process (`&`) started by the entrypoint before `exec buzz-acp`. Mints a fresh GitHub App installation token every 50 minutes and reconfigures git and gh credentials.
_Avoid_: token daemon, refresh daemon, token watcher

**minting**:
The act of exchanging a GitHub App's private key and installation ID for a short-lived installation access token via the GitHub API. Used exclusively for the agent's GitHub identity (git, gh CLI). Not used for provider auth.
_Avoid_: token generation, token fetch

**provider auth**:
The interactive OAuth device code flow that authorises a harness to call an AI provider on behalf of a human user. Triggered by `buzz-team auth <name>`, which execs `goose configure` (or the harness-equivalent) inside the running workspace container. The resulting credentials are stored inside the container by the harness; they are not part of the agent's identity.
_Avoid_: Copilot auth, goose auth (too harness-specific)

### Tooling and configuration

**buzz-team CLI**:
The npm package (command: `buzz-team`) that operators run on their host machine to provision and manage buzz-team-agents. Provides `init`, `key create`, `app create`, `app update`, `community join`, `profile publish`, `id create`, `id delete`, `workspace create`, `workspace update`, `workspace delete`, `workspace soul push`, `auth`. Noun/verb grouped (`gh`-cli style); no flat top-level `create`/`update`/`delete`.
_Avoid_: management scripts, manage-agents, CLI tool

**team config**:
The local directory containing `agents.yaml`, per-agent persona files, and `.env`. Always gitignored. Scaffolded by `buzz-team init`.
_Avoid_: project config, workspace config

**team-defaults**:
The `team-defaults` block in `agents.yaml` — shared `repos` and `workspace` settings inherited by every agent unless overridden per-agent.
_Avoid_: global config, defaults block

**workspace backend**:
The provisioning target for a workspace: `coder` (a Coder-managed container) or `docker-compose` (direct `docker compose -p <name>` invocation, optionally against a remote `host` via `DOCKER_HOST=ssh://...`). Selected per-agent under `workspace.backend` in `agents.yaml`.
_Avoid_: deployment target, provisioner

**soul push**:
The `workspace soul push <name>` action: copies local `agents/<name>/AGENTS.md` and `SOUL.md` into a running workspace's `$HOME` and restarts `buzz-acp`. The only mechanism that delivers persona to a workspace — never templated through Coder parameters or Terraform state. Used standalone and internally by `workspace create` and `workspace update --soul-only`.
_Avoid_: persona sync, soul sync

**credentials**:
Per-agent file `credentials/<name>.env`, written incrementally by `buzz-team key create` and `app create` (or their `id create` composite). Contains identity values for one agent.
_Avoid_: secrets file, env file (too generic)

**relay**:
The Buzz Nostr relay server itself (the process/infrastructure). Address supplied to the agent as `BUZZ_RELAY_URL`. Distinct from **community** (the membership relationship an agent has with it).
_Avoid_: Nostr relay (when speaking within this project's context), relay membership (use community)

**community**:
An agent's membership on the relay — granted by `buzz-team community join <name>` (SSH + `buzz-admin add-member`) using `BUZZ_RELAY_SSH` (e.g. `root@your-relay-host`) and optionally `BUZZ_RELAY_SSH_KEY`, revoked by the reverse (`buzz-admin remove-member`). Distinct from the relay (the server) and the profile (display metadata).
_Avoid_: relay enrollment, relay membership

**profile**:
A Nostr kind-0 event published to the relay that sets the agent's `display_name` and `name` fields. Published by `buzz-team profile publish <name>`, normally as the last step of `id create`. Without it, the agent appears as "Unnamed member" in Buzz Desktop.

### Coder deployment

**buzz-team-agent template**:
The Coder Terraform template (`coder/templates/buzz-team-agent/`) that provisions one workspace per buzz-team-agent. Handles container lifecycle, volume mounting, identity injection via parameters, and startup-script execution. Not the same as the legacy `buzz-agent` template.
_Avoid_: Coder template (without qualifier)

**template parameter**:
A named value declared in the Coder template and supplied at workspace creation time (e.g. `github_app_private_key`, `buzz_private_key`, `agents_md`). Stored by Coder and injected into the container as Docker environment variables.
_Avoid_: env var (when the value originates from a Coder parameter, not the operator's shell)

**startup script**:
The bash script embedded in the `coder_agent` Terraform resource. Runs inside the workspace after the Coder agent connects. Responsible for minting the initial token, writing persona files, configuring goose, and launching `buzz-acp` via `nohup`. Distinct from the container entrypoint.
_Avoid_: init script (that term belongs to the Coder agent bootstrap binary)

**init script**:
The shell script auto-generated by the Coder Terraform provider and passed as the container's CMD. Downloads the Coder agent binary from the server and runs `exec coder agent`. Must not be confused with the startup script.
_Avoid_: startup script (when referring to this lower-level bootstrap)
_Avoid_: metadata event, user profile
