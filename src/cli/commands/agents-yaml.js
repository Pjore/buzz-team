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
  const teamDefaults = doc?.['team-defaults'] ?? {};
  const agents = doc?.agents ?? {};

  const merged = {};
  for (const [name, agent] of Object.entries(agents)) {
    merged[name] = deepMerge(teamDefaults, agent ?? {});
  }
  return merged;
}

// Agent-level keys win over team-defaults; nested objects are merged per-key
// (e.g. an agent overriding only `workspace.host` keeps the other workspace defaults).
function deepMerge(base, override) {
  const result = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isPlainObject(v) && isPlainObject(base[k])) {
      result[k] = deepMerge(base[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
