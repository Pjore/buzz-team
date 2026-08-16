# tini + entrypoint script as process supervision model

Both `buzz-team-agent-base` (`debian:trixie-slim`) and `buzz-team-agent-coder` (`codercom/enterprise-base:ubuntu`) use `tini` as PID 1 with a shared `entrypoint.sh` (copied into the coder image at build time via `COPY --from`). The token-refresh loop runs as a background process (`&`) and buzz-acp runs in the foreground via `exec`. The container exits if buzz-acp crashes.

## Considered Options

- **tmux sessions**: used in the existing Coder template. Requires a PTY for attach, carries no process supervision, and is a surprising dep in a minimal image.
- **supervisord**: proper multi-process supervision with restart policies, but adds a Python dependency and a separate config format.
- **s6-overlay**: lightweight multi-process supervision (~3 MB), but diverges significantly from the existing shell-script pattern and adds unfamiliar complexity.
- **tini + entrypoint.sh** (chosen): tini handles zombie reaping; the entrypoint script manages both processes with no extra deps. If buzz-acp crashes, the container restarts via the compose `restart: unless-stopped` policy, which restarts the token-refresh loop too — acceptable.

The simplicity of a single entrypoint script was preferred over crash isolation between the two processes.
