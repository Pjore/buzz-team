# buzz-team

CLI for provisioning and managing buzz-team AI agents on a Buzz ACP Nostr relay.

## Usage

```bash
npx buzz-team@latest init
```

Scaffolds `agents.yaml`, `AGENTS.md`, `SOUL.md`, and `.env.example` in the current directory. Fill in `.env` (relay SSH target, GitHub credentials) before continuing.

```bash
npx buzz-team@latest id create <name>
```

Creates a new buzz-team-agent identity: mints a GitHub App, generates a Nostr keypair, enrolls the agent on the relay, and publishes its profile. Composes the following independently idempotent steps, each also runnable on its own:

| Command | Does |
|---|---|
| `key create <name>` | Generate (or reuse) the agent's Nostr keypair |
| `app create <name>` | Create the GitHub App via the manifest flow |
| `app update <name>` | Sync `repos` (from `agents.yaml`) to the App installation |
| `community join <name>` | Enroll the agent's pubkey on the relay |
| `community leave <name>` | Remove the agent's relay membership |
| `profile publish <name>` | Publish the agent's Nostr profile |

```bash
npx buzz-team@latest id delete <name>
```

Uninstalls the agent's GitHub App installation, removes its relay membership, and deletes its local credential file.

```bash
npx buzz-team@latest workspace create <name>
```

Provisions a running workspace for the agent (`coder` or `docker-compose` backend, per `agents.yaml`) and pushes its persona (`AGENTS.md`/`SOUL.md`). Requires `id create <name>` to have run first.

```bash
npx buzz-team@latest workspace update <name> [--soul-only]
```

Updates the agent's workspace and re-pushes its persona. `--soul-only` skips the backend update and only re-pushes the persona files.

```bash
npx buzz-team@latest workspace delete <name>
```

Tears down the agent's workspace.

```bash
npx buzz-team@latest workspace soul push <name>
```

Pushes `AGENTS.md`/`SOUL.md` into a running workspace and restarts `buzz-acp`.

```bash
npx buzz-team@latest auth <name>
```

Runs the interactive provider auth flow (e.g. `goose configure`) inside the agent's running workspace container.

## Requirements

- Node.js >= 22
- `gh` CLI authenticated (for GitHub App operations)
- SSH access to the Buzz relay host

See the [buzz-team repository](https://github.com/Pjore/buzz-team) for full documentation.
