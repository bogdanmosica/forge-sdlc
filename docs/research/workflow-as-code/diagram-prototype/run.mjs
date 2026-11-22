#!/usr/bin/env node
// PROTOTYPE, throwaway (ticket workflow-as-code 04: "What should the loop diagram look like?").
// Reads the sample workflow.yaml and forge.yaml beside it, resolves each stage's roles through
// the plugin's agents/*.md and the sample roster, and prints the loop as Mermaid (for GitHub)
// and as the /forge panel's terminal view (wide boxes at 72 columns, one-liners when narrow).
//
//   node plugins/forge-sdlc/prototype-workflow-diagram/run.mjs
//     [--at wayfinder|spec|plan|build|pr] [--stop open|flagged|risk-high|attended|none]
//     [--risk high] [--mermaid A|B|C|all|none] [--widths 72,34] [--color|--no-color]
//
// Defaults: the effort stands at plan, stopped at Gate 3 with `attended`; Mermaid variant A;
// terminal at 72 and 34 columns. No tests, no error handling: it answers a question.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const SLUG = 'workflow-as-code';
const AT = arg('at', 'plan');
const STOP = arg('stop', 'attended');
const RISK = arg('risk', 'normal');
const MERMAID = arg('mermaid', 'A');
const WIDTHS = arg('widths', '72,34').split(',').map(Number).filter(Boolean);
const COLOR = process.argv.includes('--color') || (!process.argv.includes('--no-color') && process.stdout.isTTY && !process.env.NO_COLOR);

// ---- a strict-subset YAML reader: block maps, inline [a, b] lists, scalars, # comments ----
function yaml(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').replace(/^#.*$/, '');
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const m = line.trim().match(/^([\w.-]+):\s*(.*)$/);
    while (stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1).obj;
    if (m[2] === '') {
      parent[m[1]] = {};
      stack.push({ indent, obj: parent[m[1]] });
    } else if (m[2].startsWith('[')) {
      parent[m[1]] = m[2].slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      parent[m[1]] = /^\d+$/.test(m[2]) ? Number(m[2]) : m[2] === 'true' ? true : m[2];
    }
  }
  return root;
}

const workflow = yaml(readFileSync(join(here, 'workflow.yaml'), 'utf8'));
const host = arg('host') === 'none' ? {} : yaml(readFileSync(join(here, 'forge.yaml'), 'utf8')); // --host none: no forge.yaml

// ---- resolve: role -> agent, model, effort (agents/*.md frontmatter, then the roster) ----
const shortModel = (m) => (m || '').replace(/^claude-/, '').replace(/-\d.*$/, '');
const defaults = {};
for (const f of readdirSync(join(here, '..', 'agents')).filter((f) => f.endsWith('.md'))) {
  const fm = readFileSync(join(here, '..', 'agents', f), 'utf8').split('---')[1];
  const get = (k) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim();
  defaults[get('name')] = { agent: `forge-sdlc:${get('name')}`, model: shortModel(get('model')), effort: get('effort') };
}
function role(name) {
  const d = defaults[name];
  const r = host.roles?.[name];
  if (!r) return { role: name, ...d, swapped: false };
  return { role: name, agent: r.agent ?? d.agent, model: r.model ?? d.model, effort: r.effort ?? d.effort, swapped: Boolean(r.agent && r.agent !== d.agent) };
}

// ---- resolve: who passes each gate, and why ----
const globalPolicy = host.workflow?.policy === 'autonomous' ? 'policy' : 'attended';
function gateMode(g) {
  if (g.owner) return { mode: 'code owner', why: 'Gate 4 is always the code owner’s' };
  if (RISK === 'high') return { mode: 'attended', why: 'risk: high runs attended' };
  const set = host.workflow?.gates?.[g.key];
  if (set) return { mode: set, why: `gates.${g.key} in forge.yaml` };
  return { mode: globalPolicy, why: `policy ${host.workflow?.policy ?? 'attended'}` };
}

const names = Object.keys(workflow.stages);
const atIndex = names.indexOf(AT);
const stages = names.map((name, i) => {
  const s = workflow.stages[name];
  const status = i < atIndex ? 'done' : i === atIndex ? 'current' : 'ahead';
  let gate = null;
  if (s.gate) {
    const { mode, why } = gateMode(s.gate);
    const gStatus = status === 'done' ? 'passed' : status === 'current' && STOP !== 'none' ? 'stopped' : 'ahead';
    const stops = mode === 'policy' ? s.gate.stops.filter((r) => r !== 'attended') : [];
    gate = { ...s.gate, mode, why, status: gStatus, stops };
  }
  return { name, n: i + 1, ...s, status, roles: (s.roles ?? []).map(role), gate };
});

// ---- ANSI, standing in for Text color / bold / inverse / dimColor ----
const sgr = (code) => (s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = { bold: sgr('1'), dim: sgr('2'), inv: sgr('7'), green: sgr('32'), yellow: sgr('33'), cyan: sgr('36'), boldCyan: sgr('1;36'), yellowInv: sgr('1;30;43') };

// ================= Mermaid =================
const esc = (s) => String(s).replace(/"/g, '#quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const roleLine = (r) => (r.swapped ? `${r.role} ⇄ ${r.agent} · ${r.model}` : `${r.role} · ${r.model}`);
const stageLabel = (s) => {
  if (s.end) return `<b>${s.status === 'current' ? '▶ ' : ''}PR</b><br/>${esc(s.does)}`;
  const head = `<b>${s.status === 'current' ? '▶ ' : s.status === 'done' ? '✓ ' : ''}${s.n} · ${s.name}</b>`;
  const who = s.roles.length ? s.roles.map((r) => esc(roleLine(r))) : [`lead · ${esc(s.lead)}`];
  return [head, `<i>${esc(s.does)}</i>`, ...who].join('<br/>');
};
const gateLabel = (s) => {
  const g = s.gate;
  const mark = g.status === 'stopped' ? '■ ' : g.status === 'passed' ? '✓ ' : '';
  const lines = [`${mark}Gate ${g.n} · ${g.mode}`];
  if (g.status === 'stopped') lines.push(`<b>STOPPED: ${esc(STOP)}</b>`);
  return lines.join('<br/>');
};
const passLabel = (g) =>
  g.mode === 'policy' ? `passes unless ${g.stops.join(' · ')}` : g.mode === 'attended' ? `you pass it · ${g.why}` : 'code owner reviews, merges';
const CLASSDEFS = [
  'classDef done fill:#dafbe1,stroke:#1a7f37,color:#1f2328',
  'classDef current fill:#ddf4ff,stroke:#0969da,stroke-width:3px,color:#1f2328',
  'classDef ahead fill:#f6f8fa,stroke:#8c959f,color:#1f2328',
  'classDef gpolicy fill:#ffffff,stroke:#1a7f37,color:#1f2328',
  'classDef gattended fill:#ffffff,stroke:#9a6700,stroke-dasharray:4 3,color:#1f2328',
  'classDef gowner fill:#ffebe9,stroke:#cf222e,color:#1f2328',
  'classDef stopped fill:#fff8c5,stroke:#bf8700,stroke-width:3px,color:#1f2328',
];
const gateClass = (g) => (g.status === 'stopped' ? 'stopped' : g.mode === 'policy' ? 'gpolicy' : g.mode === 'attended' ? 'gattended' : 'gowner');
const header = () => `%% ${SLUG}: at ${AT}${STOP !== 'none' ? `, stopped (${STOP})` : ''} · policy ${host.workflow?.policy ?? 'attended'} · risk ${RISK}`;

// A: one chain; who passes on the gate, the stops on the edge it passes by.
function mermaidA() {
  const out = ['%%{init: {"flowchart": {"wrappingWidth": 320}}}%%', 'flowchart TD', header()];
  stages.forEach((s, i) => {
    out.push(`  ${s.name}["${stageLabel(s)}"]:::${s.status}`);
    if (!s.gate) return;
    const g = `G${s.gate.n}`;
    out.push(`  ${g}{{"${gateLabel(s)}"}}:::${gateClass(s.gate)}`);
    out.push(`  ${s.name} --> ${g}`);
    out.push(`  ${g} ${s.gate.mode === 'policy' ? '-->' : '==>'}|"${esc(passLabel(s.gate))}"| ${stages[i + 1].name}`);
  });
  return [...out, ...CLASSDEFS.map((d) => `  ${d}`)].join('\n');
}

// B: stops as edges into one owner node beside the chain.
function mermaidB() {
  const out = ['flowchart TD', header(), `  you(["you<br/>/forge-sdlc:wayfinder ${SLUG} resumes"]):::gowner`];
  stages.forEach((s, i) => {
    out.push(`  ${s.name}["${stageLabel(s)}"]:::${s.status}`);
    if (!s.gate) return;
    const g = `G${s.gate.n}`;
    out.push(`  ${g}{{"${gateLabel(s)}"}}:::${gateClass(s.gate)}`);
    out.push(`  ${s.name} --> ${g}`);
    if (s.gate.mode === 'policy') {
      out.push(`  ${g} -->|clear| ${stages[i + 1].name}`);
      out.push(`  ${g} -.->|"${s.gate.stops.join(' · ')}"| you`);
    } else {
      out.push(`  ${g} ==>|"${s.gate.mode === 'attended' ? 'attended' : 'always'}"| you`);
      out.push(`  you -.-> ${stages[i + 1].name}`);
    }
  });
  return [...out, ...CLASSDEFS.map((d) => `  ${d}`)].join('\n');
}

// C: each stage a subgraph holding its roster, one node per role.
function mermaidC() {
  const out = ['flowchart TD', header()];
  stages.forEach((s, i) => {
    const title = s.end ? 'PR' : `${s.status === 'current' ? '▶ ' : ''}${s.n} · ${s.name}`;
    out.push(`  subgraph ${s.name}["${title}"]`, '    direction LR');
    if (s.end) out.push(`    ${s.name}_x["${esc(s.does)}"]`);
    else if (!s.roles.length) out.push(`    ${s.name}_lead["lead<br/>${esc(s.lead)}"]`);
    for (const r of s.roles) out.push(`    ${s.name}_${r.role.replace('-', '_')}["${r.swapped ? '⇄ ' : ''}${r.role}<br/>${esc(r.agent)}<br/>${r.model} · ${r.effort}"]`);
    out.push('  end', `  class ${s.name} ${s.status}`);
    if (!s.gate) return;
    const g = `G${s.gate.n}`;
    out.push(`  ${g}{{"${gateLabel(s)}"}}:::${gateClass(s.gate)}`);
    out.push(`  ${s.name} --> ${g}`);
    out.push(`  ${g} ${s.gate.mode === 'policy' ? '-->' : '==>'}|"${esc(passLabel(s.gate))}"| ${stages[i + 1].name}`);
  });
  return [...out, ...CLASSDEFS.map((d) => `  ${d}`)].join('\n');
}

// ================= terminal =================
// The stopped gate's why comes from the stop reason; the mode's source matters only for `attended`.
const stopWhy = (g) =>
  ({ open: `an open: line in ${g.artifact}`, flagged: `a flagged concern in ${g.artifact}`, 'risk-high': 'risk: high, every gate attended', attended: `attended by ${g.why}` })[STOP] ?? STOP;
const skills = (s) => (s.slots ?? []).map((k) => k.replace(/^[\w-]+\./, '')).join(' · ');
const pad = (s, w) => (s.length > w ? `${s.slice(0, Math.max(0, w - 1))}…` : s + ' '.repeat(w - s.length));

function wide(W) {
  const out = [];
  const inner = W - 4; // "│ " + content + " │"
  const policyLine = `${SLUG} · policy ${host.workflow?.policy ?? 'attended'} · risk ${RISK} · ≤${host.workflow?.max_parallel_slices ?? 3} slices`;
  out.push(c.bold(pad(policyLine, W)));
  out.push(c.dim(pad('▶ here  ✓ passed  ■ stopped  ○ ahead  ⇄ swapped in forge.yaml', W)));
  out.push('');
  for (const s of stages) {
    const border = s.status === 'current' ? c.boldCyan : s.status === 'done' ? c.green : c.dim;
    const tag = s.status === 'current' ? ' ▶ here ' : s.status === 'done' ? ' ✓ ' : '';
    const title = s.end ? ' PR ' : ` ${s.n} ${s.name} `;
    const fill = W - 3 - title.length - tag.length;
    out.push(border(`╭─${title}${'─'.repeat(Math.max(1, fill))}${tag}╮`));
    const row = (text) => out.push(border('│ ') + pad(text, inner) + border(' │'));
    row(s.does);
    if (!s.end) {
      const modelW = 16;
      const roleW = 12;
      const agentW = inner - roleW - modelW - 2;
      if (!s.roles.length) row(`${pad('lead', roleW)} ${s.lead}`);
      for (const r of s.roles) {
        const agent = (r.swapped ? '⇄ ' : '') + r.agent;
        const line = `${pad(r.role, roleW)} ${pad(agent, agentW)} ${pad(`${r.model} · ${r.effort}`, modelW)}`;
        out.push(border('│ ') + (r.swapped ? c.yellow(line) : line) + border(' │'));
      }
      if (s.slots?.length) row(c.dim(pad(`skills  ${skills(s)}`, inner)));
    }
    out.push(border(`╰${'─'.repeat(W - 2)}╯`));
    if (!s.gate) continue;
    const g = s.gate;
    const glyph = { passed: '✓', stopped: '■', ahead: '○' }[g.status];
    const mode = pad(g.mode, 12);
    let rest;
    if (g.status === 'passed') rest = g.mode === 'policy' ? 'passed by policy: nothing open' : 'passed by you';
    else if (g.status === 'stopped') rest = `STOPPED: ${stopWhy(g)}`;
    else rest = g.mode === 'policy' ? `stops on ${g.stops.join(' · ')}` : g.mode === 'attended' ? `always stops · ${g.why}` : 'always stops: reviews and merges';
    const text = pad(`${glyph} Gate ${g.n}  ${mode}${rest}`, W - 3);
    const paint = g.status === 'stopped' ? c.yellowInv : g.status === 'passed' ? c.green : (s) => s;
    out.push('  │');
    out.push(`  ${paint(text)}`);
    if (g.status === 'stopped') out.push(`  │ ${c.yellow(pad(`/forge-sdlc:wayfinder ${SLUG} resumes once you pass it`, W - 5))}`);
    out.push('  ▼');
  }
  return out.join('\n');
}

// Terminal B: passed stages fold to one line; each gate sits on the bottom border of the
// stage it closes, so the stage and who passes its gate read as one block.
function compact(W) {
  const out = [];
  const inner = W - 4;
  out.push(c.bold(pad(`${SLUG} · policy ${host.workflow?.policy ?? 'attended'} · risk ${RISK} · ≤${host.workflow?.max_parallel_slices ?? 3} slices`, W)));
  out.push(c.dim(pad('▶ here  ✓ passed  ■ stopped  ○ ahead  ⇄ swapped in forge.yaml', W)));
  const gateText = (g) => {
    const glyph = { passed: '✓', stopped: '■', ahead: '○' }[g.status];
    if (g.status === 'passed') return `${glyph} Gate ${g.n} · ${g.mode === 'policy' ? 'passed by policy' : 'passed by you'}`;
    if (g.status === 'stopped') return `${glyph} Gate ${g.n} · ${g.mode} · STOPPED: ${STOP}`;
    if (g.mode === 'policy') return `${glyph} Gate ${g.n} · policy · stops on ${g.stops.join(' · ')}`;
    return `${glyph} Gate ${g.n} · ${g.mode} · always stops`;
  };
  for (const s of stages) {
    if (s.status === 'done') {
      const who = s.roles.length ? s.roles.map((r) => r.role + (r.swapped ? ' ⇄' : '')).join(' · ') : 'lead';
      const left = pad(`✓ ${s.n} ${s.name}`, 15) + who;
      const right = s.gate ? `Gate ${s.gate.n} ✓ ${s.gate.mode}` : '';
      out.push(c.green(pad(left, W - right.length - 1) + ' ' + right));
      continue;
    }
    if (s.end) {
      out.push(c.dim(pad(`  ▼ PR  ${s.does}`, W)));
      continue;
    }
    const border = s.status === 'current' ? c.boldCyan : c.dim;
    const tag = s.status === 'current' ? ' ▶ here ' : '';
    const title = ` ${s.n} ${s.name} `;
    out.push(border(`╭─${title}${'─'.repeat(Math.max(1, W - 3 - title.length - tag.length))}${tag}╮`));
    const row = (text, paint = (x) => x) => out.push(border('│ ') + paint(pad(text, inner)) + border(' │'));
    row(s.does);
    const roleW = 12, modelW = 16, agentW = inner - roleW - modelW - 2;
    if (!s.roles.length) row(`${pad('lead', roleW)} ${s.lead}`);
    for (const r of s.roles) row(`${pad(r.role, roleW)} ${pad((r.swapped ? '⇄ ' : '') + r.agent, agentW)} ${pad(`${r.model} · ${r.effort}`, modelW)}`, r.swapped ? c.yellow : undefined);
    if (s.slots?.length) row(`skills  ${skills(s)}`, c.dim);
    const g = s.gate;
    const gt = ` ${gateText(g)} `;
    const paint = g.status === 'stopped' ? c.yellowInv : (x) => x;
    out.push(border('╰─') + paint(gt) + border(`${'─'.repeat(Math.max(1, W - 3 - gt.length))}╯`));
    if (g.status === 'stopped') {
      out.push(c.yellow(pad(`  why: ${stopWhy(g)}`, W)));
      out.push(c.yellow(pad(`  resume: /forge-sdlc:wayfinder ${SLUG}`, W)));
    }
  }
  return out.join('\n');
}

function narrow(W) {
  const out = [c.bold(pad(SLUG, W)), c.dim(pad(`policy ${host.workflow?.policy ?? 'attended'}`, W))];
  for (const s of stages) {
    const glyph = { done: '✓', current: '▶', ahead: '○' }[s.status];
    const swap = s.roles.some((r) => r.swapped) ? ' ⇄' : '';
    const line = pad(`${glyph} ${s.end ? 'PR' : `${s.n} ${s.name}`}${swap}`, W);
    out.push(s.status === 'current' ? c.inv(line) : s.status === 'done' ? c.green(line) : c.dim(line));
    if (!s.gate) continue;
    const g = s.gate;
    const gl = { passed: '✓', stopped: '■', ahead: '○' }[g.status];
    const gline = pad(`${gl}   G${g.n} ${g.mode === 'code owner' ? 'owner' : g.mode}`, W);
    out.push(g.status === 'stopped' ? c.yellowInv(gline) : g.status === 'passed' ? c.green(gline) : gline);
    if (g.status === 'stopped') out.push(c.yellow(pad(`    stop: ${STOP}`, W)));
  }
  return out.join('\n');
}

// ================= print =================
const variants = { A: mermaidA, B: mermaidB, C: mermaidC };
const picked = MERMAID === 'all' ? Object.keys(variants) : MERMAID === 'none' ? [] : [MERMAID];
for (const v of picked) console.log(`=== Mermaid, variant ${v}\n\n\`\`\`mermaid\n${variants[v]()}\n\`\`\`\n`);
const TERMINAL = arg('terminal', 'B');
const terms = { A: ['boxes, gate rows between', wide], B: ['compact, gate on the border', compact] };
for (const W of WIDTHS) {
  for (const t of W >= 52 ? (TERMINAL === 'all' ? ['A', 'B'] : [TERMINAL]) : ['narrow']) {
    const [label, fn] = t === 'narrow' ? ['narrow fallback', narrow] : terms[t];
    const rule = `=== terminal ${t === 'narrow' ? '' : `${t} `}at ${W} columns: ${label} `;
    console.log(rule + '='.repeat(Math.max(0, W - rule.length)));
    console.log(fn(W));
    console.log();
  }
}
