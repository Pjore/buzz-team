# buzz-team

CLI for provisioning and managing buzz-team AI agents on a Buzz ACP Nostr relay.

## Usage

```bash
npx buzz-team@latest init
```

Scaffolds `agents.yaml`, `AGENTS.md`, `SOUL.md`, and `.env.example` in the current directory. Fill in `.env` (relay SSH target, GitHub credentials) before continuing.

```bash
npx buzz-team@latest create <name>
```

Creates a new buzz-team-agent: mints a GitHub App identity, generates a Nostr keypair, enrolls the agent on the relay, and publishes its profile.

```bash
npx buzz-team@latest update <name>
```

Syncs repository access for an existing agent.

```bash
npx buzz-team@latest auth <name>
```

Runs the interactive provider auth flow (e.g. `goose configure`) inside the agent's running workspace container.

```bash
npx buzz-team@latest delete <name>
```

Uninstalls the agent's GitHub App installation, removes its relay membership, and deletes its local credential file.

## Requirements

- Node.js >= 22
- `gh` CLI authenticated (for GitHub App operations)
- SSH access to the Buzz relay host

See the [buzz-team repository](https://github.com/Pjore/buzz-team) for full documentation.
