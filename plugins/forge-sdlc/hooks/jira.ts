// The Jira ticket a branch names, for the Focus pane's TICKET row: the key from
// the branch, the ticket's status and summary from Jira's REST API through the
// host's fetch, cached JIRA_TTL_MS per key in ~/.cache/workbench/jira/.
//
// Compliance / security notes (GDPR data minimization, NIS2):
//   - Credentials: JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN come from the
//     log-work skill's .env (WORKBENCH_JIRA_ENV, default
//     ~/.claude/skills/log-work/.env); values in the environment win. The
//     token lives in a local of `fetchIssue` for one request: never in
//     `$.state`, the session record, the cache, a log or an error text.
//   - Request: GET /rest/api/2/issue/<KEY>?fields=summary,status. The host's
//     fetch verifies TLS against the system trust store, which holds the
//     internal CA (checked 2026-10-28), so JIRA_VERIFY_SSL=false is not needed.
//   - Stored: key, status name, summary and URL only. No people fields.
import type { EngineInterface } from 'claude-code';
import type { FocusJira } from './types';

const JIRA_TTL_MS = 10 * 60_000;
const CRED_KEYS = ['JIRA_DOMAIN', 'JIRA_EMAIL', 'JIRA_API_TOKEN'] as const;
type Creds = Record<(typeof CRED_KEYS)[number], string>;

const isTrunk = (branch: string) => branch === 'main' || branch === 'master' || branch === 'HEAD';

// The first "<letters>-<digits>" pair of a branch name's dash-separated words
// as a Jira key: feat/eosmkp-188701-x -> EOSMKP-188701.
export function jiraKey(branch: string | undefined): string | undefined {
  if (!branch || isTrunk(branch)) return undefined;
  for (const segment of branch.split('/')) {
    const words = segment.split('-');
    for (let i = 0; i + 1 < words.length; i++) {
      const [letters = '', digits = ''] = [words[i], words[i + 1]];
      if (/^[A-Za-z]+$/.test(letters) && /^\d+$/.test(digits)) return `${letters}-${digits}`.toUpperCase();
    }
  }
  return undefined;
}

// A dotenv file's KEY=VALUE pairs: optional `export `, quotes, # comments.
export function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    const k = line
      .slice(0, at)
      .trim()
      .replace(/^export\s+/, '');
    let v = line.slice(at + 1).trim();
    if (v.length >= 2 && v[0] === v.at(-1) && (v[0] === '"' || v[0] === "'")) v = v.slice(1, -1);
    else if (v.includes(' #')) v = v.slice(0, v.indexOf(' #')).trimEnd();
    if (/^[A-Za-z_]\w*$/.test(k)) env[k] = v;
  }
  return env;
}

async function creds($: EngineInterface, home: string): Promise<Creds | undefined> {
  const path = (await $.env.get('WORKBENCH_JIRA_ENV')) || `${home}/.claude/skills/log-work/.env`;
  let file: Record<string, string> = {};
  try {
    file = parseEnv(await $.fs.read(path));
  } catch {
    // no .env: the environment alone may still hold them
  }
  // the engine lists what a module reads, so each name is spelled out
  const live = {
    JIRA_DOMAIN: await $.env.get('JIRA_DOMAIN'),
    JIRA_EMAIL: await $.env.get('JIRA_EMAIL'),
    JIRA_API_TOKEN: await $.env.get('JIRA_API_TOKEN'),
  };
  const out = {} as Creds;
  for (const k of CRED_KEYS) out[k] = (live[k] || file[k] || '').trim();
  if (!out.JIRA_DOMAIN || !out.JIRA_EMAIL || !out.JIRA_API_TOKEN) return undefined;
  while (out.JIRA_DOMAIN.endsWith('/')) out.JIRA_DOMAIN = out.JIRA_DOMAIN.slice(0, -1);
  if (!/^https?:\/\//.test(out.JIRA_DOMAIN)) out.JIRA_DOMAIN = `https://${out.JIRA_DOMAIN}`;
  return out;
}

type Issue = { key?: string; fields?: { summary?: string; status?: { name?: string } } };

async function fetchIssue($: EngineInterface, home: string, key: string) {
  const c = await creds($, home);
  if (!c) return undefined;
  const basic = btoa(`${c.JIRA_EMAIL}:${c.JIRA_API_TOKEN}`);
  const auth = c.JIRA_API_TOKEN.startsWith('Bearer ') ? c.JIRA_API_TOKEN : `Basic ${basic}`;
  const res = await $.http.fetch(`${c.JIRA_DOMAIN}/rest/api/2/issue/${encodeURIComponent(key)}?fields=summary,status`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  if (!res.ok) return undefined;
  const issue = JSON.parse(res.text) as Issue;
  const real = issue.key || key;
  const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
  return {
    key: real,
    url: `${c.JIRA_DOMAIN}/browse/${real}`,
    status: clean(issue.fields?.status?.name),
    summary: clean(issue.fields?.summary),
  };
}

// The ticket, from the cache while fresh, else from Jira; null off VPN,
// without credentials or for a key Jira refuses.
export async function jiraState($: EngineInterface, key: string): Promise<FocusJira | null> {
  const home = await $.env.get('HOME');
  if (!home) return null;
  const now = await $.clock.now();
  const cacheFile = `${home}/.cache/workbench/jira/${key}.json`;
  try {
    const hit = JSON.parse(await $.fs.read(cacheFile)) as FocusJira;
    if (hit.key && now - hit.checkedAt < JIRA_TTL_MS) return hit;
  } catch {
    // not cached yet
  }
  try {
    const issue = await fetchIssue($, home, key);
    if (!issue) return null;
    const ticket: FocusJira = { ...issue, checkedAt: now };
    await $.fs.write(cacheFile, JSON.stringify(ticket)).catch(() => undefined);
    return ticket;
  } catch {
    return null; // unreachable (VPN), refused by policy, or not JSON
  }
}
