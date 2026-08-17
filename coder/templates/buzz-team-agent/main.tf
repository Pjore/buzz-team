terraform {
  required_providers {
    coder = {
      source  = "coder/coder"
      version = ">= 2.16"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}

locals {
  container_name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}"
  bot_name       = "${data.coder_parameter.github_owner.value}-${data.coder_parameter.agent_name.value}[bot]"
  bot_email      = "${data.coder_parameter.github_owner.value}-${data.coder_parameter.agent_name.value}[bot]@users.noreply.github.com"

  preview_list = [for s in split(",", data.coder_parameter.preview_ports.value) : trimspace(s) if trimspace(s) != ""]
  preview_map = {
    for entry in local.preview_list :
    split(":", entry)[0] => {
      port  = split(":", entry)[0]
      label = length(split(":", entry)) > 1 ? split(":", entry)[1] : "App ${split(":", entry)[0]}"
    }
  }
}

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

data "coder_parameter" "arch" {
  display_name = "CPU Architecture"
  name         = "arch"
  type         = "string"
  default      = "arm64"
  mutable      = false
  option {
    name  = "AMD64 (Intel/AMD)"
    value = "amd64"
  }
  option {
    name  = "ARM64 (Hetzner ARM)"
    value = "arm64"
  }
}

data "coder_parameter" "agent_name" {
  display_name = "Agent Name"
  name         = "agent_name"
  type         = "string"
  default      = "agent"
  mutable      = false
  validation {
    regex = "^[a-z][a-z0-9-]*$"
    error = "Must be lowercase alphanumeric (e.g. gilfoyle)"
  }
}

data "coder_parameter" "github_owner" {
  display_name = "GitHub Owner (user or org)"
  name         = "github_owner"
  type         = "string"
  mutable      = false
}

data "coder_parameter" "buzz_relay_url" {
  display_name = "Buzz Relay URL"
  name         = "buzz_relay_url"
  type         = "string"
  default      = ""
  mutable      = true
}

data "coder_parameter" "buzz_private_key" {
  display_name = "Buzz Private Key"
  name         = "buzz_private_key"
  type         = "string"
  mutable      = false
}

data "coder_parameter" "github_app_id" {
  display_name = "GitHub App ID"
  name         = "github_app_id"
  type         = "string"
  mutable      = false
}

data "coder_parameter" "github_app_installation_id" {
  display_name = "GitHub App Installation ID"
  name         = "github_app_installation_id"
  type         = "string"
  mutable      = false
}

data "coder_parameter" "github_app_private_key" {
  description  = "PEM private key — newlines stored as literal \\n"
  display_name = "GitHub App Private Key"
  name         = "github_app_private_key"
  type         = "string"
  mutable      = false
}

data "coder_parameter" "agents_md" {
  display_name = "AGENTS.md"
  name         = "agents_md"
  type         = "string"
  default      = ""
  mutable      = true
}

data "coder_parameter" "soul_md" {
  display_name = "SOUL.md"
  name         = "soul_md"
  type         = "string"
  default      = ""
  mutable      = true
}

data "coder_parameter" "preview_ports" {
  display_name = "Preview Ports"
  name         = "preview_ports"
  type         = "string"
  default      = ""
  mutable      = true
}

# ---------------------------------------------------------------------------
# Persistent home volume
# ---------------------------------------------------------------------------

resource "docker_volume" "home_volume" {
  name = "coder-${data.coder_workspace.me.id}-home"
  labels {
    label = "coder.owner"
    value = data.coder_workspace_owner.me.name
  }
  labels {
    label = "coder.workspace_id"
    value = data.coder_workspace.me.id
  }
}

# ---------------------------------------------------------------------------
# Workspace container
# ---------------------------------------------------------------------------

resource "docker_container" "workspace" {
  count = data.coder_workspace.me.start_count

  dns      = ["1.1.1.1"]
  hostname = lower(data.coder_workspace.me.name)
  image    = "ghcr.io/${data.coder_parameter.github_owner.value}/buzz-team-agent-coder:latest"
  name     = local.container_name
  command  = [
    "sh", "-c",
    <<-EOT
    set -e
    export DEBIAN_FRONTEND=noninteractive
    export PATH="/home/coder/.local/bin:$PATH"

    ${replace(coder_agent.main.init_script, "/localhost|127\\.0\\.0\\.1/", "host.docker.internal")}
    sleep infinity
    EOT
  ]

  memory             = 4294967296
  memory_reservation = 2147483648
  cpu_shares         = 512
  must_run           = false

  env = [
    "CODER_AGENT_TOKEN=${coder_agent.main.token}",
    "BUZZ_RELAY_URL=${data.coder_parameter.buzz_relay_url.value}",
    "BUZZ_PRIVATE_KEY=${data.coder_parameter.buzz_private_key.value}",
    "BUZZ_ACP_KINDS=9,30078",
    "BUZZ_ACP_RESPOND_TO=anyone",
    "BUZZ_ACP_SUBSCRIBE=mentions",
    "BUZZ_ACP_AGENTS=2",
    "GITHUB_APP_ID=${data.coder_parameter.github_app_id.value}",
    "GITHUB_APP_INSTALLATION_ID=${data.coder_parameter.github_app_installation_id.value}",
    "GITHUB_APP_PRIVATE_KEY=${data.coder_parameter.github_app_private_key.value}",
    "BOT_NAME=${local.bot_name}",
    "BOT_EMAIL=${local.bot_email}",
    "AGENTS_MD=${data.coder_parameter.agents_md.value}",
    "SOUL_MD=${data.coder_parameter.soul_md.value}",
    "GOOSE_PROVIDER=github_copilot",
    "GOOSE_MODEL=claude-sonnet-4.6",
  ]

  host {
    host = "host.docker.internal"
    ip   = "host-gateway"
  }

  volumes {
    container_path = "/home/coder"
    volume_name    = docker_volume.home_volume.name
    read_only      = false
  }

  stop_timeout = 300
  stop_signal  = "SIGINT"
  labels {
    label = "coder.workspace_id"
    value = data.coder_workspace.me.id
  }
}

# ---------------------------------------------------------------------------
# Coder agent
# ---------------------------------------------------------------------------

resource "coder_agent" "main" {
  arch = data.coder_parameter.arch.value
  os   = "linux"

  startup_script = <<-STARTUP
    #!/bin/bash
    set -eo pipefail
    echo "=== Buzz agent workspace ready: ${data.coder_parameter.agent_name.value} ==="
    grep -qxF 'export PATH="/home/coder/.local/bin:$PATH"' /home/coder/.bashrc 2>/dev/null \
      || echo 'export PATH="/home/coder/.local/bin:$PATH"' >> /home/coder/.bashrc

    # Mint initial GitHub App token (GITHUB_APP_PRIVATE_KEY is set in container env by Terraform)
    TOKEN=$(GH_APP_ID="${data.coder_parameter.github_app_id.value}" \
      GH_INSTALL_ID="${data.coder_parameter.github_app_installation_id.value}" \
      node << 'NODESCRIPT'
const crypto=require('crypto'),https=require('https');
const keyRaw=process.env.GITHUB_APP_PRIVATE_KEY||'';
const keyPem=keyRaw.replace(/\\n/g,'\n');
const pk=crypto.createPrivateKey(keyPem);
const now=Math.floor(Date.now()/1000);
const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
const p=Buffer.from(JSON.stringify({iat:now-60,exp:now+540,iss:process.env.GH_APP_ID})).toString('base64url');
const sig=crypto.createSign('RSA-SHA256').update(h+'.'+p).sign(pk,'base64url');
const jwt=h+'.'+p+'.'+sig;
const opts={hostname:'api.github.com',path:'/app/installations/'+process.env.GH_INSTALL_ID+'/access_tokens',method:'POST',
  headers:{'Authorization':'Bearer '+jwt,'Accept':'application/vnd.github+json','User-Agent':'buzz-agent/1.0','X-GitHub-Api-Version':'2022-11-28'}};
https.request(opts,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const r=JSON.parse(d);r.token?process.stdout.write(r.token):(process.stderr.write(JSON.stringify(r)+'\n'),process.exit(1));});}).on('error',e=>{process.stderr.write(e.message+'\n');process.exit(1);}).end();
NODESCRIPT
    )
    [[ -n "$TOKEN" ]] || { echo "ERROR: token mint failed"; exit 1; }

    # Configure git and gh CLI
    mkdir -p "$HOME/.config/gh"
    cat > "$HOME/.config/gh/hosts.yml" << EOF
github.com:
  oauth_token: $${TOKEN}
  git_protocol: https
  user: x-access-token
EOF
    printf 'https://x-access-token:%s@github.com\n' "$TOKEN" > "$HOME/.git-credentials"
    chmod 600 "$HOME/.git-credentials"
    git config --global credential.helper store
    git config --global user.name "${local.bot_name}"
    git config --global user.email "${local.bot_email}"

    # Write persona files from parameters
    if [[ -n "${data.coder_parameter.agents_md.value}" ]]; then
      printf '%s' "${data.coder_parameter.agents_md.value}" > "$HOME/AGENTS.md"
    fi
    if [[ -n "${data.coder_parameter.soul_md.value}" ]]; then
      printf '%s' "${data.coder_parameter.soul_md.value}" > "$HOME/SOUL.md"
    fi

    # Configure goose
    mkdir -p "$HOME/.config/goose"
    cat > "$HOME/.config/goose/profiles.yaml" << 'GOOSE_PROFILE'
default:
  provider: github_copilot
  model: claude-sonnet-4.6
  extensions:
    context:
      type: file
      path: ~/AGENTS.md
GOOSE_PROFILE

    # Start token refresh daemon via tmux
    cat > "$HOME/.buzz-token-refresh.sh" << 'REFRESH'
#!/bin/bash
while true; do
  sleep 3300
  /usr/local/bin/token-refresh.sh
done
REFRESH
    chmod +x "$HOME/.buzz-token-refresh.sh"
    tmux new-session -d -s buzz-token-refresh "exec bash $HOME/.buzz-token-refresh.sh" 2>/dev/null || true

    # Start buzz-acp
    BUZZ_RELAY_URL="${data.coder_parameter.buzz_relay_url.value}" \
    BUZZ_PRIVATE_KEY="${data.coder_parameter.buzz_private_key.value}" \
    BUZZ_ACP_KINDS=9,30078 \
    BUZZ_ACP_RESPOND_TO=anyone \
    BUZZ_ACP_SUBSCRIBE=mentions \
    BUZZ_ACP_AGENTS=2 \
    BOT_NAME="${local.bot_name}" \
    BOT_EMAIL="${local.bot_email}" \
      nohup buzz-acp --agent-command goose --agent-args acp >> /tmp/buzz-acp.log 2>&1 &
    echo "=== buzz-acp started (PID $!) ==="
  STARTUP

  display_apps {
    port_forwarding_helper = true
    ssh_helper             = true
    vscode                 = true
    vscode_insiders        = true
    web_terminal           = true
  }
}

# ---------------------------------------------------------------------------
# Preview app ports
# ---------------------------------------------------------------------------

resource "coder_app" "preview" {
  for_each     = local.preview_map
  agent_id     = coder_agent.main.id
  slug         = "preview-${each.value.port}"
  display_name = each.value.label
  url          = "http://localhost:${each.value.port}"
  subdomain    = true
  share        = "owner"
}

# ---------------------------------------------------------------------------
# Dashboard metadata
# ---------------------------------------------------------------------------

resource "coder_metadata" "workspace_info" {
  count       = data.coder_workspace.me.start_count
  resource_id = docker_container.workspace[0].id

  item {
    key   = "Agent"
    value = data.coder_parameter.agent_name.value
  }
  item {
    key   = "Relay"
    value = data.coder_parameter.buzz_relay_url.value
  }
  item {
    key   = "GitHub App ID"
    value = data.coder_parameter.github_app_id.value
  }
}
