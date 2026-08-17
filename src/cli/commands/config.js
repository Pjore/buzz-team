import fs from 'fs';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';

export function loadConfig(opts = {}) {
  // Load .env from cwd if present
  dotenvConfig({ path: path.join(process.cwd(), '.env') });

  // Precedence: CLI flags > .env (loaded into process.env) > existing env vars
  return {
    GITHUB_TOKEN: opts.githubToken || process.env.GITHUB_TOKEN,
    BUZZ_RELAY_SSH: opts.relaySsh || process.env.BUZZ_RELAY_SSH,
    BUZZ_RELAY_SSH_KEY: process.env.BUZZ_RELAY_SSH_KEY,
  };
}
