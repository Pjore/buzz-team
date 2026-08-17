import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

export function readAgentsYaml() {
  const yamlPath = path.join(process.cwd(), 'agents.yaml');
  if (!fs.existsSync(yamlPath)) {
    console.error('ERROR: agents.yaml not found — run buzz-team init first');
    process.exit(1);
  }
  const doc = parse(fs.readFileSync(yamlPath, 'utf8'));
  return doc?.agents ?? {};
}
