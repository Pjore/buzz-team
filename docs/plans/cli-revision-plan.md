# buzz-team CLI Revision Plan

Follow-on to [`buzz-team-plan.md`](./buzz-team-plan.md) (Milestones 1–6, already implemented). Covers the `id`/`app`/`community`/`profile` command split and the new `workspace` provisioning command family, resolved via a grilling session — see [`docs/adr/0008-persona-pushed-by-cli-not-terraform.md`](../adr/0008-persona-pushed-by-cli-not-terraform.md) and `CONTEXT.md` (`community`, `team-defaults`, `workspace backend`, `soul push`) for the settled terminology.

---

## Milestone 7 — Identity command restructuring (breaking change, no back-compat)

**Goal**: Replace the flat `create <name>` / `update <name>` / `delete <name>` commands with `gh`-cli-style noun/verb primitives, each independently idempotent, plus composite convenience commands. Pre-1.0, single known consumer (`buzz-team-sv`) — hard cut, no deprecated aliases.

**New command surface**:

| Command | Replaces | Idempotency check |
|---|---|---|
| `key create <name>` | step 1 of `create` | local `credentials/<name>.env` (`BUZZ_PRIVATE_KEY` present) |
| `app create <name>` | step 2 of `create` | local `credentials/<name>.env` (`GITHUB_APP_*` present) |
| `app update <name>` | today's `update <name>` | n/a — always syncs `repos` to the installation |
| `community join <name>` | relay enrollment step of `create` | idempotent server-side (`buzz-admin add-member`) |
| `community leave <name>` | relay-membership part of `delete` | idempotent server-side (`buzz-admin remove-member`) |
| `profile publish <name>` | profile step of `create` | idempotent server-side (kind:0 replaceable event) |
| `id create <name>` | `create <name>` (composite) | runs the 4 steps above in order: key → app → community join → profile publish |
| `id delete <name>` | `delete <name>` (composite) | uninstall App, `community leave`, delete `credentials/<name>.env`; profile is left unpublished (matches today's known gap) |

**Steps**:

1. Split `commands/create.js` into `commands/key.js` (`create`), `commands/app.js` (`create`, `update` — moves today's `update.js` logic in), `commands/community.js` (`join`, `leave` — reuses `enrollInRelay`/`removeFromRelay` logic from `create.js`/`delete.js`), `commands/profile.js` (`publish`).
2. `commands/id.js`: `create` composes key→app→community→profile; `delete` composes App uninstall→community leave→credentials removal (port from `delete.js`).
3. Delete `commands/create.js`, `commands/update.js`, `commands/delete.js` once ported — no aliases kept.
4. `bin/buzz-team.js`: register nested commands via Commander (e.g. `program.command('key create <name>')`, `program.command('id create <name>')`, etc. — Commander supports multi-word command strings directly, no manual sub-program needed).
5. Update `src/cli/README.md` with the new command table.

**Acceptance**: `npx buzz-team id create jared` on a clean checkout produces an identical `credentials/jared.env` to today's `create jared`; re-running any individual step or the composite is a no-op resume, matching current resumable behavior.

---

## Milestone 8 — `agents.yaml` schema v2 (`team-defaults` + `workspace` block)

**Goal**: Introduce `team-defaults` (shared `repos` + `workspace` settings) with per-agent override, and a `workspace` block describing where/how each agent's workspace is provisioned.

**Schema**:
```yaml
team-defaults:
  repos: [Pjore/buzz-team-sv]        # GitHub App repo access, shared default
  workspace:
    harness: goose                    # goose | codex — AI runner inside the container
    backend: coder                    # coder | docker-compose
    arch: arm64
    template: buzz-team-agent         # coder backend only
    host: https://coder.example.com   # coder URL, or docker DOCKER_HOST target

agents:
  jared:
    workspace:
      host: https://other-coder.example.com   # per-agent override
    env: { GOOSE_PROVIDER: github_copilot, GOOSE_MODEL: claude-sonnet-4.6 }
```

**Steps**:

1. Update `commands/agents-yaml.js`'s `readAgentsYaml()` to deep-merge `team-defaults` under each agent (agent-level keys win), rather than returning agents as-is.
2. Update `src/cli/defaults/agents.example.yaml` to the new shape.
3. `CONTEXT.md` already updated with `team-defaults` and `workspace backend` (see ADR 0008).

**Acceptance**: an agent with no `workspace` block at all inherits everything from `team-defaults`; an agent overriding only `host` keeps `backend`/`arch`/`template`/`harness` from the default.

---

## Milestone 9 — `workspace` commands

**Goal**: `buzz-team workspace create|update|delete|soul push <name>`, dispatching to a `coder` or `docker-compose` backend per `agents.yaml`.

**Steps**:

1. `commands/workspace/prereqs.js`: backend-specific checks with instructive failure messages —
   - coder: `coder` on `PATH`; `coder whoami` (or equivalent) succeeds → else "coder CLI not authenticated — run: coder login <url>"; target template exists (`coder templates list`) → else "template not found — run: coder templates push <template>".
   - docker-compose: `docker` on `PATH`; `docker info` succeeds → else "docker daemon not reachable at <host>".
2. `commands/workspace/coder.js`: `create` → `coder create <name> --template <template> --parameter arch=... --parameter agent_name=... --parameter buzz_relay_url=... --parameter buzz_private_key=... --parameter github_app_id=... --parameter github_app_installation_id=... --parameter github_app_private_key=... --parameter github_owner=... --yes` (values read from `credentials/<name>.env`, PEM read via `fs.readFileSync` — no shell/Python extraction needed since we're not going through a shell env var). `update` → `coder update <name> --parameter ... --yes` (same params, minus recreate-only ones). `delete` → `coder delete <name> --yes`.
3. `commands/workspace/docker-compose.js`: `create`/`update` → `DOCKER_HOST=<host> docker compose -p <name> --env-file credentials/<name>.env -f compose/docker-compose.yml up -d`; `delete` → same prefix with `down -v`.
4. `commands/workspace/soul.js` (`push <name>`): reads `agents/<name>/AGENTS.md` + `SOUL.md` (local, per `buzz-team-sv`'s convention), pipes them into the workspace — coder backend: `coder ssh <name> -- 'cat > ~/AGENTS.md'` (stdin), same for `SOUL.md`; docker-compose backend: `docker compose -p <name> exec -T buzz-agent sh -c 'cat > /root/AGENTS.md'`. Then restarts `buzz-acp` (`coder ssh <name> -- 'pkill -f buzz-acp; nohup buzz-acp ... &'` / `docker compose -p <name> restart`).
5. `commands/workspace/create.js`: prereqs → hard-fail if `credentials/<name>.env` missing ("run `buzz-team id create <name>` first" — no auto-chaining) → backend `create` → `soul.push(name)` as the final step (new workspaces have no persona until this runs).
6. `commands/workspace/update.js`: prereqs → backend `update`; if `--soul-only` flag set, skip backend `update` entirely and only call `soul.push(name)`.
7. `commands/workspace/delete.js`: prereqs → backend `delete`.
8. `bin/buzz-team.js`: register `workspace create <name>`, `workspace update <name> [--soul-only]`, `workspace delete <name>`, `workspace soul push <name>`.

**Acceptance**: `buzz-team workspace create jared` on a host with `coder` CLI authenticated and the template pushed provisions a running workspace with persona files already in place, no manual `coder create ...` invocation needed.

---

## Milestone 10 — Coder template: remove persona parameters

**Goal**: `coder/templates/buzz-team-agent/main.tf` no longer has `agents_md`/`soul_md` parameters or writes persona files in `startup_script` — persona arrives exclusively via `soul push` (Milestone 9, ADR 0008).

**Steps**:

1. Remove `data.coder_parameter.agents_md` and `data.coder_parameter.soul_md` blocks.
2. Remove the `"AGENTS_MD=..."` / `"SOUL_MD=..."` lines from `docker_container.workspace`'s `env`.
3. Remove the "Write persona files from parameters" block from `coder_agent.main`'s `startup_script`.
4. `coder templates push buzz-team-agent --directory coder/templates/buzz-team-agent --yes`.
5. Recreate `jared`'s existing workspace in `buzz-team-sv` against the updated template (delete + `workspace create jared`, once Milestones 7–9 land), verifying persona arrives via `soul push` and the agent reconnects to the relay correctly.

**Acceptance**: `terraform plan` for the template shows no `agents_md`/`soul_md`-related diffs ever again; a freshly created workspace has no persona files until `workspace soul push` runs.
