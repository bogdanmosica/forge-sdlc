// The host config, docs/agents/forge.md, as the run pane reads it: the same
// `## Section` headings and `- key: value` bullets the guardrail hooks parse in
// hooks/scripts/lib.mjs (parseForgeConfig), ported to TypeScript because a mod
// cannot import the hooks' script. Keep the two parsers in step:
// tests/run-pane-config.test.mjs holds them to the same reading. Pure: run-pane.tsx
// reads the file and hands the text here. No imports, so node tests load it as it is.

export const HOST_CONFIG = 'docs/agents/forge.md';

// `{ [section]: { [key]: value } }`: section keys lower-case with spaces as `-`.
export type ForgeConfig = Record<string, Record<string, string>>;

const sectionKey = (heading: string) => heading.trim().toLowerCase().replace(/\s+/g, '-');
const unquote = (word: string) => word.replace(/^(["'`])(.*)\1$/, '$2');

// A forge.md text to its sections; a trailing `# comment` is dropped, quotes stripped.
export function parseForgeConfig(text: string): ForgeConfig {
  const config: ForgeConfig = {};
  let section: string | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd();
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      section = sectionKey(heading[1]!);
      config[section] ??= {};
      continue;
    }
    const bullet = /^-\s+([^:]+):\s*(.*)$/.exec(line);
    if (bullet && section) config[section]![bullet[1]!.trim()] = unquote(bullet[2]!.trim());
  }
  return config;
}

// A comma-separated value as a list, as lib.mjs's listOf reads one.
export const listOf = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
