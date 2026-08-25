---
name: coder-workspace
description: Manage Coder workspaces for buzz-team-agents — push templates, create/start/stop/delete workspaces, troubleshoot startup failures, understand how the Coder agent bootstrap works. Use when provisioning a new agent workspace, debugging a failed build, or updating the template.
---

# Coder Workspace Management

## Key facts

- **Coder server**: `$CODER_URL`
- **Template**: `buzz-team-agent` at `coder/templates/buzz-team-agent/`
- **Container image**: `ghcr.io/$GHCR_OWNER/buzz-team-agent-coder:latest` (ARM64)
- **SSH key**: `awesome-infra/keys/coder-ssh-key.pem`

## Template push

```bash
coder templates push buzz-team-agent \
  --directory coder/templates/buzz-team-agent --yes
```

After pushing, **existing workspaces are NOT automatically updated**. Run `coder update <workspace>` or delete and recreate.

## Workspace creation

Extract credentials safely with Python to avoid shell-quoting issues (PEM key has spaces):

```bash
GITHUB_APP_PRIVATE_KEY=$(python3 -c "
import re
d=open('credentials/fry.env').read()
m=re.search(r\"GITHUB_APP_PRIVATE_KEY='?(.*?)'?\$\", d, re.MULTILINE|re.DOTALL)
print(m.group(1).strip().strip(\"'\") if m else '', end='')
")

coder create buzz-fry \
  --template buzz-team-agent \
  --parameter arch=arm64 \
  --parameter agent_name=fry \
  --parameter buzz_relay_url=$BUZZ_RELAY_URL \
  --parameter "buzz_private_key=$BUZZ_PRIVATE_KEY" \
  --parameter "github_app_id=$GITHUB_APP_ID" \
  --parameter "github_app_installation_id=$GITHUB_APP_INSTALLATION_ID" \
  --parameter "github_app_private_key=$GITHUB_APP_PRIVATE_KEY" \
  --parameter "github_owner=$GHCR_OWNER" \
  --parameter "agents_md=$(cat AGENTS.md)" \
  --parameter "soul_md=$(cat SOUL.md)" \
  --yes
```

Do not use `source credentials/<name>.env` to load the PEM key — even with the quoted fix, zsh expands the variable with real newlines, which breaks HCL string interpolation in Terraform. Always extract via Python.

## How container startup works

1. **Terraform creates the container** with `command = ["sh", "-c", "<init_script with localhost→host.docker.internal>"]`. This is the Coder agent bootstrap — it downloads the `coder` binary and runs `exec coder agent`.
2. **Coder agent connects** to `$CODER_URL` and runs the `startup_script`.
3. **Startup script** mints the GitHub token, writes persona files, configures goose, launches `buzz-acp` via `nohup`.

`buzz-acp` runs as a detached process (not PID 1). Logs at `/tmp/buzz-acp.log`.

## Critical template rules

- **Never set `ENTRYPOINT`** in the coder image Dockerfile. The `codercom/enterprise-base:ubuntu` CMD mechanism is how the Coder agent bootstraps. Overriding the entrypoint causes the container to exit immediately (`exitCode=0, execDuration=0`).
- **Always use** `replace(coder_agent.main.init_script, "/localhost|127\\.0\\.0\\.1/", "host.docker.internal")` in the `command` — the Coder server URL often resolves to localhost inside the provisioner.
- **Set `must_run = false`** on the `docker_container` resource to prevent the kreuzwerker/docker provider from failing on startup timing.
- The `GITHUB_APP_PRIVATE_KEY` Docker env var has **literal `\n`** (two chars). In Node.js: `keyRaw.replace(/\\n/g, '\n')` before calling `createPrivateKey`.

## Debugging failures

**"container exited immediately"**: Almost always a wrong container command. Check:
- Is `ENTRYPOINT` overriding Coder's bootstrap?
- Is the `command` set to `["sh", "-c", coder_agent.main.init_script]`?
- Is `must_run = false`?

Run interactively on the Coder server to reproduce:
```bash
ssh -i awesome-infra/keys/coder-ssh-key.pem root@$CODER_SSH_HOST
docker run --rm ghcr.io/$GHCR_OWNER/buzz-team-agent-coder:latest sh -c 'echo ok && sleep 2'
```

**"ERR_OSSL_UNSUPPORTED" in startup script**: The `GITHUB_APP_PRIVATE_KEY` env var is empty. Root cause: the credential file had an unquoted PEM value that was truncated by the shell. Fix: regenerate credentials or use Python extraction above.

**`coder ssh` hangs or fails when pushing persona files / restarting `buzz-acp`** (used by `buzz-team workspace soul push` / `update`): `coder ssh` allocates a PTY and defaults to waiting on the startup script, both of which break naive remote commands. Root causes and fixes:
- **Piping file content over stdin hangs forever.** `execSync('coder ssh <ws> -- "cat > file"', {input: content})` never delivers EOF — the PTY echoes the input back instead of terminating the write. Fix: encode content as base64 and pass it inline in the command string: `coder ssh --wait no <ws> -- 'printf %s <base64> | base64 -d > ~/<file>'`.
- **`--wait auto` (the default) hangs** because our `startup_script` backgrounds long-running daemons and never "completes". Always pass `--wait no` (`--no-wait` also works but is deprecated).
- **`pkill -f buzz-acp` kills the wrong thing.** Inside `coder ssh <ws> -- '...'`, the remote shell's own command line contains the string `buzz-acp`, so a pattern-based `pkill -f` matches and kills the session itself (`Process exited with status 255`). Use `pkill -x buzz-acp` (exact process name) instead.
- **A relaunched daemon dies when the ssh session tears down**, even with `nohup ... & disown`. `nohup` alone isn't enough — the process is still in the ssh session's process group and gets torn down with it. Fix: launch with `setsid` to put it in its own session, and add a trailing `sleep 2` after backgrounding it so it has time to actually detach before the shell (and the ssh connection) exits:
  `pkill -x buzz-acp || true; setsid nohup buzz-acp ... >> /tmp/buzz-acp.log 2>&1 < /dev/null & disown; sleep 2`.

**Startup script logs**: `coder ssh <workspace> -- cat /tmp/coder-startup-script.log`

**Container process list**: `ssh root@$CODER_SSH_HOST "docker exec coder-<owner>-<name> ps aux"`

**Pre-pull image** to avoid download timeouts during workspace start:
```bash
ssh -i awesome-infra/keys/coder-ssh-key.pem root@$CODER_SSH_HOST \
  "docker pull ghcr.io/$GHCR_OWNER/buzz-team-agent-coder:latest"
```

## Image publishing

Both images must be published to ghcr.io and made **public** before the Coder server can pull them:

```bash
# Login first (needs write:packages scope)
TOKEN=$(gh auth token) && echo "$TOKEN" | docker login ghcr.io -u $GHCR_OWNER --password-stdin

# Build and push base image (must come first)
docker buildx build --platform linux/arm64 --push \
  --build-arg GHCR_OWNER=$GHCR_OWNER \
  -t ghcr.io/$GHCR_OWNER/buzz-team-agent-base:latest images/base/

# Build and push coder image
docker buildx build --platform linux/arm64 --push \
  --build-arg GHCR_OWNER=$GHCR_OWNER \
  -t ghcr.io/$GHCR_OWNER/buzz-team-agent-coder:latest images/coder/
```
