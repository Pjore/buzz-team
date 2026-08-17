# GitHub App token minting as the sole authentication flow

Both `buzz-team-agent-base` and `buzz-team-agent-coder` authenticate to GitHub exclusively via GitHub App installation token minting. The GitHub Copilot device code flow (previously used in the basic docker-compose image via a volume-persisted goose config) is removed.

## Considered Options

- **Device code flow** (previous basic image approach): user authenticates once interactively; long-lived token persisted in a volume. Simpler for personal use, but not automatable and requires human interaction on first start.
- **Personal access token**: simple to configure, but scoped to a user account rather than an app identity. Does not satisfy the soul/body model where each agent has its own GitHub identity.
- **GitHub App minting** (chosen): fully automated, no human interaction after `buzz-team create`. Both images share the same auth entrypoint logic. The operator creates one GitHub App per agent via `buzz-team create`; thereafter all token refresh is headless.

## Consequences

Users running `buzz-team-agent-base` via docker-compose must run `buzz-team create` first to obtain a GitHub App. There is no simpler "just run with a PAT" path.
