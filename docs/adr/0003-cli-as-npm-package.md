# buzz-team CLI distributed as an npm package

The operator tooling (`buzz-team init`, `buzz-team create`, etc.) is distributed as an npm package rather than shell scripts in the repo.

## Considered Options

- **Shell scripts in repo (cloned)**: low friction to write, but forces every operator to clone or fork `buzz-team` just to get the CLI. Couples tooling distribution to source distribution.
- **Shell scripts distributed via Homebrew / curl**: portable but harder to maintain cross-platform (macOS/Linux), no dependency management.
- **npm package** (chosen): operators run `npx buzz-team` without cloning anything. The package owns the provisioning logic (GitHub App creation, Nostr key generation, relay enrollment). Node.js is already a required dep on the operator machine (used for token minting elsewhere in the project). Config precedence — CLI flags > `.env` > env vars — is straightforward to implement.

## Consequences

- `buzz-team` is published to npm; a version bump is required to ship CLI changes.
- The `src/cli/` directory in the repo is the package source; `src/agents.yaml` and persona files are user-local and gitignored.
