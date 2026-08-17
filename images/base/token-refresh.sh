#!/bin/bash
# token-refresh.sh — GitHub App installation token refresh daemon
# Refreshes every 50 minutes (tokens expire after 1 hour).
set -euo pipefail

REFRESH_INTERVAL=3000

LOG_FILE="$HOME/.github-token-refresh.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

mint_token() {
  local key_file
  key_file=$(mktemp)
  chmod 600 "$key_file"
  printf '%b' "$GITHUB_APP_PRIVATE_KEY" > "$key_file"
  trap 'rm -f "$key_file"' RETURN

  GH_APP_ID="$GITHUB_APP_ID" \
  GH_INSTALL_ID="$GITHUB_APP_INSTALLATION_ID" \
  GH_APP_KEY_FILE="$key_file" \
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
}

apply_token() {
  local token="$1"
  mkdir -p "$HOME/.config/gh"
  cat > "$HOME/.config/gh/hosts.yml" << EOF
github.com:
  oauth_token: ${token}
  git_protocol: https
  user: x-access-token
EOF
  printf 'https://x-access-token:%s@github.com\n' "$token" > "$HOME/.git-credentials"
  chmod 600 "$HOME/.git-credentials"
  git config --global user.name "$BOT_NAME"
  git config --global user.email "$BOT_EMAIL"
  log "Token applied — git/gh credentials updated"
}

refresh_once() {
  log "Refreshing GitHub App token..."
  local token
  token=$(mint_token 2>>"$LOG_FILE") || { log "ERROR: mint_token failed"; return 1; }
  [[ -n "$token" ]] || { log "ERROR: empty token returned"; return 1; }
  apply_token "$token"
  log "Token refresh successful"
}

log "Token refresh daemon starting (interval: ${REFRESH_INTERVAL}s)"

while true; do
  sleep "$REFRESH_INTERVAL"
  refresh_once || log "WARN: Token refresh failed — will retry in ${REFRESH_INTERVAL}s"
done
