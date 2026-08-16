# buzz-team Implementation Plan

## Domain Model

### Terms

- **buzz-team-agent**: A 1:1 pairing of an *identity* (Nostr keypair + GitHub App) and a *workspace* (isolated container or VPS). The agent is the soul+body unit.
- **identity**: Nostr keypair + GitHub App (app ID, installation ID, private key PEM). Runtime-injected, never baked into images.
- **workspace**: A running container or VPS dedicated to one agent. Hosts goose, sprig/buzz-acp, persona files, and the token-refresh loop.
- **harness**: The AI runner inside the workspace. Currently `goose` (GitHub Copilot) only.
- **buzz-team-agent-base**: ARM64 Docker image (`ghcr.io/pjore/buzz-team-agent-base`). Contains all runtime deps. Floor is `debian:trixie-slim`. Used directly for basic docker-compose deployments and as a binary source for the Coder image.
- **buzz-team-agent-coder**: ARM64 Docker image (`ghcr.io/pjore/buzz-team-agent-coder`). Floors on `codercom/enterprise-base:ubuntu`. Extracts pre-built binaries (sprig, goose) from `buzz-team-agent-base` at build time via multi-stage `COPY --from`. Used as the container image in the Coder template.
- **buzz-team CLI** (`buzz-team`): npm package providing `buzz-team init`, `buzz-team create`, `buzz-team update`, `buzz-team delete`. Runs on the operator's host machine.
- **team config**: Local directory containing `agents.yaml`, per-agent `AGENTS.md` / `SOUL.md`, and `.env`. Never committed; `.gitignore`d. Scaffolded by `buzz-team init`.
- **credentials**: Per-agent `credentials/<name>.env` file. Written by `buzz-team create`. Contains GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY, BUZZ_PRIVATE_KEY.
- **sprig**: Multi-call binary that provides `buzz-acp` and `buzz` entrypoints. Built from `ghcr.io/pjore/buzz-sprig:latest`. Copied into the base image at build time.
- **token-refresh loop**: Background bash process (`&`) that mints a fresh GitHub App installation token every 50 minutes and reconfigures git/gh credentials. Started by the container entrypoint before `exec buzz-acp`.
- **relay**: Buzz Nostr relay. Agents are enrolled via SSH by `buzz-team create`. Address provided as env var `BUZZ_RELAY_URL`.

### Entrypoint process model (both images)

```
tini (PID 1)
  └── entrypoint.sh
        ├── token-refresh.sh &   (background loop)
        └── exec buzz-acp        (foreground, PID of tini child)
```

Container exits if buzz-acp crashes. Token-refresh dies with it. No supervisord, no tmux.

---

## Repository Layout

```
buzz-team/
├── images/
│   ├── base/
│   │   ├── Dockerfile
│   │   └── entrypoint.sh
│   └── coder/
│       ├── Dockerfile            (FROM buzz-team-agent-base)
│       └── entrypoint.sh
├── compose/
│   ├── docker-compose.yml
│   └── .env.example
├── coder/
│   └── templates/
│       └── buzz-agent/
│           ├── main.tf
│           └── token-refresh.sh.tftpl   (if still needed post-image)
├── src/
│   ├── defaults/                 (packaged with CLI; copied by `buzz-team init`)
│   │   ├── agents.example.yaml
│   │   ├── AGENTS.md
│   │   ├── SOUL.md
│   │   └── .env.example
│   ├── agents.yaml               (gitignored — user-local)
│   ├── cli/                      (buzz-team npm package)
│   │   ├── package.json
│   │   ├── bin/buzz-team.js
│   │   └── commands/
│   │       ├── init.js
│   │       ├── create.js
│   │       ├── update.js
│   │       └── delete.js
│   └── scripts/
│       └── publish-agent-profiles.js   (ported from awesome-infra)
├── docs/
│   └── plans/
│       └── buzz-team-plan.md
└── .github/
    └── workflows/
        ├── build-base.yml
        └── build-coder.yml
```

---

## Milestones

### Milestone 1 — `buzz-team-agent-base` Docker image

**Goal**: Build and publish `ghcr.io/pjore/buzz-team-agent-base:latest` for ARM64. This image replaces the inline apt-install block in the current Coder template's `command` and the `buzz-sprig` copy workaround.

**Steps**:

1. Create `images/base/Dockerfile` (mirrors `Dockerfile.goose` pattern):
   - Stage 1: `FROM ghcr.io/pjore/buzz-sprig:latest AS sprig`
   - Stage 2: `FROM debian:trixie-slim`
   - Install: `tini`, `nodejs` (v22 via NodeSource), `gh` CLI, `curl`, `git`, `ca-certificates`, `bash`, `bzip2`
   - `COPY --from=sprig /usr/local/bin/sprig /usr/local/bin/sprig`
   - Create symlinks: `sprig` → `buzz-acp`, `sprig` → `buzz` under `/usr/local/bin`
   - Install `goose` from GitHub releases (latest ARM64 binary)
   - Copy `entrypoint.sh` and `token-refresh.sh` to `/usr/local/bin/`; set executable
   - `ENTRYPOINT ["tini", "--", "/usr/local/bin/entrypoint.sh"]`

2. Create `images/base/entrypoint.sh`:
   - Accept env vars: `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` (literal `\n` encoded PEM), `BUZZ_PRIVATE_KEY`, `BUZZ_RELAY_URL`, `BUZZ_ACP_*`, `GOOSE_PROVIDER`, `GOOSE_MODEL`, `BOT_NAME`, `BOT_EMAIL`
   - On startup: mint GitHub App token via inline Node.js (same logic as current template), write `~/.config/gh/hosts.yml` and `~/.git-credentials`, set git identity
   - Write `AGENTS.md` and `SOUL.md` to `$HOME` if `AGENTS_MD` / `SOUL_MD` env vars are set (base64-encoded or heredoc)
   - Configure goose `profiles.yaml` if `GOOSE_PROVIDER` is set
   - Start `token-refresh.sh` as background process (`&`)
   - `exec buzz-acp`

3. Create `images/base/token-refresh.sh` (standalone script, copied into image at `/usr/local/bin/token-refresh.sh`):
   - Port logic from `awesome-infra/coder/templates/buzz-agent/token-refresh.sh.tftpl`
   - Remove Terraform template syntax; use env vars directly
   - Loop: sleep 3000s, mint token, apply to git/gh

4. Create `.github/workflows/build-base.yml`:
   - Trigger: push to `main` affecting `images/base/**`, or manual
   - Build for `linux/arm64` using `docker buildx`
   - Push to `ghcr.io/pjore/buzz-team-agent-base`
   - Tag: `latest` + git SHA

**Acceptance**: `docker run --rm -e GITHUB_APP_ID=... -e ... ghcr.io/pjore/buzz-team-agent-base:latest` starts buzz-acp connected to relay.

---

### Milestone 2 — `buzz-team-agent-coder` Docker image

**Goal**: Build `ghcr.io/pjore/buzz-team-agent-coder:latest` extending the base image, suitable for use as `image` in the Coder template.

**Steps**:

1. Create `images/coder/Dockerfile` (multi-stage, extracts binaries from base image):
   - Stage 1: `FROM ghcr.io/pjore/buzz-team-agent-base:latest AS base`
   - Stage 2: `FROM codercom/enterprise-base:ubuntu`
   - `COPY --from=base /usr/local/bin/sprig /usr/local/bin/sprig`
   - `COPY --from=base /usr/local/bin/goose /usr/local/bin/goose`
   - `COPY --from=base /usr/local/bin/tini /usr/local/bin/tini` (or install via apt)
   - `COPY --from=base /usr/local/bin/entrypoint.sh /usr/local/bin/entrypoint.sh`
   - `COPY --from=base /usr/local/bin/token-refresh.sh /usr/local/bin/token-refresh.sh`
   - Re-create symlinks: `sprig` → `buzz-acp`, `sprig` → `buzz`
   - Install `gh` CLI and `nodejs` (v22) via apt if not already in `codercom/enterprise-base`
   - `ENTRYPOINT ["tini", "--", "/usr/local/bin/entrypoint.sh"]`

2. `images/coder/entrypoint.sh` is not needed — share the entrypoint from the base image via `COPY --from`.

3. Create `.github/workflows/build-coder.yml`:
   - Trigger: push to `main` affecting `images/coder/**` or after `build-base.yml` succeeds
   - Build for `linux/arm64`
   - Push to `ghcr.io/pjore/buzz-team-agent-coder`

**Acceptance**: Coder template using `image = "ghcr.io/pjore/buzz-team-agent-coder:latest"` starts a workspace with buzz-acp running, without any apt installs or sprig copy workarounds in `main.tf`.

---

### Milestone 3 — Coder template (`buzz-agent`)

**Goal**: Port and simplify `awesome-infra/coder/templates/buzz-agent/main.tf` to use `buzz-team-agent-coder`. Remove all inline install logic and sprig seed workaround.

**Steps**:

1. Copy template to `coder/templates/buzz-agent/main.tf`
2. Change `image` in `docker_container.workspace` to `ghcr.io/pjore/buzz-team-agent-coder:latest`
3. Remove the `command` block's apt install / goose install / sprig install sections — these are now in the image
4. Simplify `startup_script` in `coder_agent.main`: remove token minting (now in entrypoint), remove goose profile setup (now in entrypoint). Keep only:
   - Coder agent init script injection
   - Writing persona files if passed as parameters (or delegate to entrypoint via env vars)
   - Starting the token-refresh tmux session if still desired for interactive debugging, otherwise remove
5. Pass identity credentials as env vars to the container (`GITHUB_APP_ID`, etc.) rather than re-minting in startup_script
6. Remove `token-refresh.sh.tftpl` if token refresh is fully handled in the image
7. Keep the `sprig` seed SSH step in `manage-agents.sh` removed (no longer needed)

**Acceptance**: `coder create <name> --template buzz-agent --parameter ...` creates a workspace that starts in under 60 seconds with no apt installs happening at runtime.

---

### Milestone 4 — docker-compose deployment (`buzz-team-agent-base`)

**Goal**: Provide a minimal docker-compose setup for running a buzz-team-agent on a local machine or VPS (ARM64).

**Steps**:

1. Create `compose/docker-compose.yml`:
   - Use `ghcr.io/pjore/buzz-team-agent-base:latest`
   - Map all identity env vars from `.env` file
   - Mount a local `config/` directory to `$HOME` for persistent AGENTS.md, SOUL.md, goose config
   - Port from `awesome-infra/buzz/agents/docker-compose.yml`

2. Create `compose/.env.example` with all required variables and comments:
   ```
   BUZZ_RELAY_URL=wss://buzz.pjore.com
   BUZZ_PRIVATE_KEY=
   GITHUB_APP_ID=
   GITHUB_APP_INSTALLATION_ID=
   GITHUB_APP_PRIVATE_KEY=
   BOT_NAME=
   BOT_EMAIL=
   GOOSE_MODEL=claude-sonnet-4.6
   ```

**Acceptance**: `cp .env.example .env && vi .env && docker compose up` runs a connected buzz-team-agent.

---

### Milestone 5 — `buzz-team` CLI

**Goal**: npm package providing `buzz-team init`, `buzz-team create`, `buzz-team update`, `buzz-team delete`. Replaces `manage-agents.sh`.

**Configuration precedence**: CLI flags (1) > `.env` file in cwd (2) > environment variables (3).

**Required config** (for `create`):
- `GITHUB_TOKEN` — personal access token with app creation rights
- `BUZZ_RELAY_SSH` — SSH URL to relay server (e.g. `root@89.167.54.102`)
- `WORKSPACE_SSH` — SSH URL to the agent workspace (e.g. `coder.alice` or `user@vps`)

**Steps**:

1. Scaffold `src/cli/package.json`:
   - `name: "buzz-team"`, `bin: { "buzz-team": "./bin/buzz-team.js" }`
   - Dependencies: `commander`, `yaml`, `dotenv`, `node-fetch` (or native fetch Node 22)

2. Implement `buzz-team init`:
   - Copies `src/defaults/agents.example.yaml` → `agents.yaml` (if not exists)
   - Copies `src/defaults/AGENTS.md`, `src/defaults/SOUL.md`, `src/defaults/.env.example` → cwd
   - Adds `agents.yaml`, `.env`, `credentials/` to `.gitignore`
   - Prints next steps
   - `src/defaults/` is bundled inside the npm package via `files` in `package.json`

3. Implement `buzz-team create <name>`:
   - Reads `agents.yaml` for agent config (harness, repos)
   - Creates GitHub App via manifest flow (opens browser to GitHub, waits for callback or manual input of returned credentials)
   - Generates Nostr keypair (port of secp256k1 logic from `manage-agents.sh`)
   - Derives Nostr pubkey
   - Adds repos to GitHub App installation via GitHub API
   - Enrolls pubkey in relay via SSH: `ssh $BUZZ_RELAY_SSH "docker exec \$(docker ps --filter name=-relay- --format '{{.ID}}' | head -1) buzz-admin add-member --pubkey <pubkey> --role member"`
   - Publishes Nostr kind-0 profile (port of `publish-agent-profiles.js`)
   - Writes `credentials/<name>.env`
   - Prints workspace env vars ready to copy

4. Implement `buzz-team update <name>`:
   - Port of `cmd_update` from `manage-agents.sh`
   - Syncs repo access on the GitHub App installation

5. Implement `buzz-team delete <name>`:
   - Removes GitHub App, deletes `credentials/<name>.env`

6. Port `src/scripts/publish-agent-profiles.js` from `awesome-infra/buzz/scripts/`

7. Write `src/defaults/agents.example.yaml` with documented schema:
   ```yaml
   agents:
     alice:
       harness: goose
       repos:
         - pjore/my-repo
   ```

8. Write `src/defaults/AGENTS.md` (generic default instructions placeholder)

9. Write `src/defaults/SOUL.md` (generic default persona placeholder)

10. Write `src/defaults/.env.example` with all required variables and inline comments

11. Add `src/agents.yaml`, `.env`, and `credentials/` to `.gitignore`

**Acceptance**: `npx buzz-team init && npx buzz-team create alice` completes end-to-end on a fresh clone, producing a working `credentials/alice.env`.

---

### Milestone 6 — CI/CD and cleanup

**Goal**: GitHub Actions publish both images on merge to main. Deprecate buzz-agent artifacts in `awesome-infra`.

**Steps**:

1. Finalize `build-base.yml` and `build-coder.yml` with multi-arch support note (ARM64 now, x86 later — add `linux/amd64` to buildx platform list when ready)
2. Add `CODEOWNERS` or release tagging strategy
3. In `awesome-infra`: remove `buzz/agents/`, `coder/templates/buzz-agent/`, `coder/agents/manage-agents.sh`, `coder/agents/create-app.js`, `buzz/scripts/publish-agent-profiles.js` once `buzz-team` equivalents are verified
4. Update `awesome-infra` README to point to `buzz-team`

---

## Constraints

- All images: `linux/arm64` first. `linux/amd64` added later without breaking ARM.
- `buzz-team-agent-base` floor: `debian:trixie-slim` — no Coder tooling, minimal footprint.
- `buzz-team-agent-coder` floor: `codercom/enterprise-base:ubuntu` — extracts binaries from base via multi-stage `COPY --from`; no redundant apt installs.
- No tmux in images. Process model: `tini` → `entrypoint.sh` → `token-refresh.sh &` + `exec buzz-acp`.
- `GITHUB_APP_PRIVATE_KEY` stored with literal `\n` (not real newlines). `printf '%b'` used to expand before writing to temp file.
- `agents.yaml` and `.env` are always gitignored in user repos. Shipped as `.example` variants only.
- CLI config precedence: flags > `.env` > env vars.
- Persona files (`AGENTS.md`, `SOUL.md`) and `agents.yaml` defaults live in `src/defaults/`, bundled with the npm package. `buzz-team init` copies them to the operator's cwd. The images do not ship default persona files.
