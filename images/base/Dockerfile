# ── Stage 1: extract sprig binary ──────────────────────────────────────────────
ARG GHCR_OWNER
FROM ghcr.io/${GHCR_OWNER}/buzz-sprig:latest AS sprig

# ── Stage 2: runtime ───────────────────────────────────────────────────────────
FROM debian:trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    curl \
    ca-certificates \
    git \
    bash \
    bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# goose CLI (ARM64)
RUN curl -fsSL https://github.com/block/goose/releases/latest/download/download_cli.sh \
    | CONFIGURE=false bash \
    && mv /root/.local/bin/goose /usr/local/bin/goose

COPY --from=sprig /usr/local/bin/sprig /usr/local/bin/sprig
RUN ln -s /usr/local/bin/sprig /usr/local/bin/buzz-acp \
 && ln -s /usr/local/bin/sprig /usr/local/bin/buzz

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY token-refresh.sh /usr/local/bin/token-refresh.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/token-refresh.sh

ENV GOOSE_PROVIDER=github_copilot
ENV GOOSE_MODEL=claude-sonnet-4.6

ENTRYPOINT ["tini", "--", "/usr/local/bin/entrypoint.sh"]
