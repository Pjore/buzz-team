#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Mint initial GitHub App installation token
# ---------------------------------------------------------------------------
_KEY_FILE=$(mktemp)
chmod 600 "$_KEY_FILE"
printf '%b' "${GITHUB_APP_PRIVATE_KEY}" > "$_KEY_FILE"

TOKEN=$(GH_APP_ID="${GITHUB_APP_ID}" \
  GH_INSTALL_ID="${GITHUB_APP_INSTALLATION_ID}" \
  GH_APP_KEY_FILE="$_KEY_FILE" \
  node << 'NODESCRIPT'
const fs=require('fs'),crypto=require('crypto'),https=require('https');
const keyPem=fs.readFileSync(process.env.GH_APP_KEY_FILE,'utf8');
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
rm -f "$_KEY_FILE"
[[ -n "$TOKEN" ]] || { echo "ERROR: token mint failed"; exit 1; }

# ---------------------------------------------------------------------------
# Apply token to git and gh CLI
# ---------------------------------------------------------------------------
mkdir -p "$HOME/.config/gh"
cat > "$HOME/.config/gh/hosts.yml" << EOF
github.com:
  oauth_token: ${TOKEN}
  git_protocol: https
  user: x-access-token
EOF
printf 'https://x-access-token:%s@github.com\n' "$TOKEN" > "$HOME/.git-credentials"
chmod 600 "$HOME/.git-credentials"
git config --global credential.helper store
git config --global user.name "${BOT_NAME:-buzz-agent[bot]}"
git config --global user.email "${BOT_EMAIL:-buzz-agent[bot]@users.noreply.github.com}"

# ---------------------------------------------------------------------------
# Write persona files if provided as env vars
# ---------------------------------------------------------------------------
if [[ -n "${AGENTS_MD:-}" ]]; then
  printf '%s' "${AGENTS_MD}" > "$HOME/AGENTS.md"
fi
if [[ -n "${SOUL_MD:-}" ]]; then
  printf '%s' "${SOUL_MD}" > "$HOME/SOUL.md"
fi

# ---------------------------------------------------------------------------
# Configure goose if provider is set
# ---------------------------------------------------------------------------
if [[ -n "${GOOSE_PROVIDER:-}" ]]; then
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
fi

# ---------------------------------------------------------------------------
# Start token refresh daemon in background
# ---------------------------------------------------------------------------
GITHUB_APP_ID="${GITHUB_APP_ID}" \
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID}" \
GITHUB_APP_PRIVATE_KEY="${GITHUB_APP_PRIVATE_KEY}" \
BOT_NAME="${BOT_NAME:-buzz-agent[bot]}" \
BOT_EMAIL="${BOT_EMAIL:-buzz-agent[bot]@users.noreply.github.com}" \
  /usr/local/bin/token-refresh.sh &

# ---------------------------------------------------------------------------
# Hand off to buzz-acp
# ---------------------------------------------------------------------------
exec buzz-acp \
  --agent-command goose \
  --agent-args acp
