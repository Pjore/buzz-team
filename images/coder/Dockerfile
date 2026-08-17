# ── Stage 1: extract binaries from base image ──────────────────────────────────
ARG GHCR_OWNER
FROM ghcr.io/${GHCR_OWNER}/buzz-team-agent-base:latest AS base

# ── Stage 2: Coder workspace image ─────────────────────────────────────────────
FROM codercom/enterprise-base:ubuntu

# Copy pre-built binaries from base image
COPY --from=base /usr/local/bin/sprig /usr/local/bin/sprig
COPY --from=base /usr/local/bin/goose /usr/local/bin/goose
COPY --from=base /usr/local/bin/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --from=base /usr/local/bin/token-refresh.sh /usr/local/bin/token-refresh.sh

RUN sudo apt-get update && sudo apt-get install -y --no-install-recommends tini \
 && sudo rm -rf /var/lib/apt/lists/* \
 && sudo ln -sf /usr/local/bin/sprig /usr/local/bin/buzz-acp \
 && sudo ln -sf /usr/local/bin/sprig /usr/local/bin/buzz \
 && sudo chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/token-refresh.sh

# Node.js 22 and gh CLI if not already present in base image
RUN if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ] 2>/dev/null; then \
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - \
      && sudo apt-get install -y --no-install-recommends nodejs; \
    fi \
 && if ! command -v gh >/dev/null 2>&1; then \
      curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null \
      && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null \
      && sudo apt-get update && sudo apt-get install -y --no-install-recommends gh; \
    fi \
 && sudo rm -rf /var/lib/apt/lists/*

ENV GOOSE_PROVIDER=github_copilot
ENV GOOSE_MODEL=claude-sonnet-4.6

