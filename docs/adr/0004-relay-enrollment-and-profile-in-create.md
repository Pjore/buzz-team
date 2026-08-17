# Agent onboarding: relay enrollment and profile publishing as part of `create`

`buzz-team create` performs two post-keypair steps against the live relay: SSH enrollment and Nostr kind-0 profile publishing.

## Considered Options

- **Manual enrollment**: operator runs `buzz-admin add-member` and `publish-agent-profiles.js` by hand after `create`. Simple to implement but error-prone — agents go live as "Unnamed member" and unconnected.
- **API-based enrollment**: expose relay membership via an HTTP API to avoid SSH dependency. Not available on the current relay implementation.
- **SSH enrollment + profile publish in `create`** (chosen): `create` SSHes into the relay host, runs `buzz-admin add-member` inside the relay container, then publishes a kind-0 profile event over WebSocket. Atomic from the operator's perspective.

## Consequences

- `BUZZ_RELAY_SSH` (and optionally `BUZZ_RELAY_SSH_KEY`) are required env vars for relay-connected agents. Agents created without them are not enrolled and will be rejected by the relay.
- Profile publishing requires `nostr-tools` and `ws` installed globally (`npm install -g nostr-tools ws`). If absent, `create` warns and skips — the profile can be published manually with `src/scripts/publish-agent-profiles.js`.
- The relay container is located by `docker ps --filter name=-relay-`, which matches Dokploy's compose naming scheme (`compose-<stack>-relay-1`).
