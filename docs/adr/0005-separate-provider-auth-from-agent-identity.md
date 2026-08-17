# ADR-0005: Separate provider auth from agent identity

**Status:** Accepted

## Context

A buzz-team-agent needs two distinct forms of authentication:

1. **Agent identity** — the GitHub App installation token that lets the agent act as itself on GitHub (commits, PRs, issues). Minted from a private key; fully automated via the token-refresh loop.
2. **Provider auth** — credentials that allow the harness (e.g. goose) to call an AI provider (e.g. GitHub Copilot, Anthropic) on behalf of a human user with a subscription.

The naive approach would be to reuse the GitHub App installation token for both. This fails: installation tokens are server-to-server and carry no Copilot subscription — the Copilot API requires a user-scoped OAuth token tied to a paying account.

A second option was to perform the provider device code flow during `buzz-team create` and store the resulting token in `credentials/<name>.env`. This was rejected because it couples the create flow to a live browser session and produces a short-lived user token that cannot be automatically refreshed without storing a refresh token (which Copilot's device flow does not expose).

## Decision

Provider auth is a separate concern from agent identity:

- `credentials/<name>.env` may contain provider credentials (arbitrary env vars from the `env` block in `agents.yaml`) when the operator has a long-lived API key (e.g. Anthropic, OpenAI).
- When no credentials are present, `buzz-team auth <name>` triggers the harness's own interactive configure flow (`goose configure`, `codex login`, etc.) inside the running container. The harness stores and manages its own credentials.
- The `agents.yaml` `env` block is a free-form key-value map — `buzz-team` has no knowledge of provider-specific env var names or token formats.

## Consequences

- The auth step is optional and post-create; `buzz-team create` emits a hint when no provider credentials are detected.
- Provider credential lifetime and rotation are the harness's responsibility, not buzz-team's.
- Coder workspaces are handled implicitly: `GITHUB_COPILOT_TOKEN` injected by `coder_external_auth` is picked up by goose without any extra step.
- Adding a new harness or provider requires no changes to buzz-team CLI — only an `agents.yaml` entry and a mapping in `HARNESS_CONFIGURE` in `auth.js`.
