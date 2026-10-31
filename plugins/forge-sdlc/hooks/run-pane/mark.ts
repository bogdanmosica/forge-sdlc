// Mark: the word at the left of the band, `forge` unless the host config names
// its own. Pure: run-pane.tsx reads the file and puts the mark on the snapshot.
//
// Host config (`docs/agents/forge.md`), an optional section:
//   ## Mark
//   - text: iZi                 the word, in the default colour
//   - color: "#8b5cf6"          optional: a terminal colour name, or a hex (#rgb or #rrggbb) in quotes, as a bare # starts a comment
//   - text: none                no mark
import type { ForgeConfig } from './config';
import type { MarkPart } from '../types';

export const FORGE_MARK: MarkPart[] = [{ text: 'forge' }];

export type Mark = { parts: MarkPart[]; problems: string[] };

const SHAPE = 'mark ignored: ## Mark needs a `text` bullet (a word, or none)';

// The host config to the mark's parts and the problems, each a line for the
// band. No config or no section is forge; text "none" is no mark.
export function parseMark(config: ForgeConfig | undefined): Mark {
  const forge: Mark = { parts: FORGE_MARK, problems: [] };
  const section = config?.mark;
  if (!section) return forge;
  const text = section.text?.trim() ?? '';
  const color = section.color?.trim() ?? '';
  if (text.toLowerCase() === 'none') return { parts: [], problems: [] };
  if (!text) return { parts: FORGE_MARK, problems: [SHAPE] };
  return { parts: [color ? { text, color } : { text }], problems: [] };
}
