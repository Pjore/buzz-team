import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULTS_DIR = path.resolve(__dirname, '../../defaults');

export async function init() {
  const cwd = process.cwd();

  const copies = [
    ['agents.example.yaml', 'agents.yaml'],
    ['AGENTS.md', 'AGENTS.md'],
    ['SOUL.md', 'SOUL.md'],
    ['.env.example', '.env.example'],
  ];

  for (const [src, dest] of copies) {
    const destPath = path.join(cwd, dest);
    if (fs.existsSync(destPath)) {
      console.log(`  skip  ${dest} (already exists)`);
      continue;
    }
    fs.copyFileSync(path.join(DEFAULTS_DIR, src), destPath);
    console.log(`  create ${dest}`);
  }

  // Append to .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  const ignoreEntries = ['agents.yaml', '.env', 'credentials/'];
  let existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  let added = false;
  for (const entry of ignoreEntries) {
    if (!existing.split('\n').includes(entry)) {
      existing += `\n${entry}`;
      added = true;
    }
  }
  if (added) {
    fs.writeFileSync(gitignorePath, existing.trimStart());
    console.log('  update .gitignore');
  }

  console.log('\nNext steps:');
  console.log('  1. Edit agents.yaml — add your agents');
  console.log('  2. Edit AGENTS.md and SOUL.md — set the agent persona');
  console.log('  3. Copy .env.example → .env and fill GITHUB_TOKEN and BUZZ_RELAY_SSH');
  console.log('  4. Run: buzz-team create <name>');
}
