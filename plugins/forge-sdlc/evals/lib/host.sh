# Sourced by every fixture.sh under evals/: builds a fixture host in the current directory (the
# eval's empty workspace, or a temp dir in tests/evals.test.mjs). `claude plugin eval` runs a
# scaffold only under --scaffold, as you, outside the agent's sandbox, with PATH, HOME (the
# run's temp home), TMPDIR and TERM only. Synthetic data only: no real person, no real credential.
set -euo pipefail

EVALS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_ROOT="$(cd "$EVALS/.." && pwd)"
SLUG=word-count

# repo: a small Node host with one commit on main. Identity is repo-local: the temp home has no gitconfig.
repo() {
  git init -q -b main
  git config user.name fixture
  git config user.email fixture@example.invalid
  git config commit.gpgsign false
  printf '{\n  "name": "word-count",\n  "type": "module",\n  "scripts": { "test": "node --test" }\n}\n' > package.json
  printf '# word-count\n\nCounts words and lines.\n' > README.md
  printf '# word-count\n\n## Agent skills\n' > CLAUDE.md
  printf '.forge/\n.upstream/\n' > .gitignore
  mkdir -p src tests
  printf 'export const countWords = (text) => text.split(/\\s+/).filter(Boolean).length;\n' > src/count.mjs
  printf "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { countWords } from '../src/count.mjs';\n\ntest('counts words', () => assert.equal(countWords('a b  c'), 3));\n" > tests/count.test.mjs
  commit "host"
}

# tracker: the local-markdown tracker doc Matt's setup writes (what init's precondition reads).
tracker() {
  mkdir -p docs/agents
  printf '# Issue tracker\n\nLocal markdown: one file per ticket under `.scratch/<slug>/issues/<nn>-<title>.md`, a `Blocked by:` line for each edge, closed by `Status: closed`.\n' > docs/agents/issue-tracker.md
}

# config [formatter]: docs/agents/forge.md in the shape init writes; the formatter defaults to none.
config() {
  mkdir -p docs/agents
  cat > docs/agents/forge.md <<MD
# forge-sdlc host config

## Proof commands
- test: node --test
- typecheck: none
- lint: none
- build: none

## Formatter
- command: ${1:-none}

## Branches
- default: main
- protected: main
- effort: feat/<slug>
- slice: slice/<slug>-<nn>

## Worktrees
- dependency_dir: none

## Gates
- spec: always
- max_parallel_slices: 3

## Risk
- high: none

## Policy skills
- skills: none

## Test file globs
- globs: tests/**
MD
}

commit() { git add -A && git commit -qm "$1"; }
branch() { git switch -q -c "$1"; }

# effort: the three-ticket fixture effort, its artifacts on the effort folder and its local tickets.
effort() {
  mkdir -p "docs/efforts/$SLUG" ".scratch/$SLUG/issues"
  cp "$EVALS/fixtures/$SLUG/"*.md "docs/efforts/$SLUG/"
  cp "$EVALS/fixtures/$SLUG/issues/"*.md ".scratch/$SLUG/issues/"
}

# state <stage> <gate> [mode] [slice-status]: .forge/state.json for the effort, slices 01-03.
state() {
  local s="${4:-open}"
  mkdir -p .forge
  cat > .forge/state.json <<JSON
{
  "version": 1,
  "efforts": {
    "$SLUG": {
      "stage": "$1", "gate": "$2", "mode": "${3:-normal}", "risk": "normal", "branch": "feat/$SLUG", "pr": null,
      "slices": {
        "$SLUG-01": { "status": "$s", "mode": "normal", "ticket": ".scratch/$SLUG/issues/01-count-lines.md" },
        "$SLUG-02": { "status": "$s", "mode": "normal", "ticket": ".scratch/$SLUG/issues/02-count-chars.md" },
        "$SLUG-03": { "status": "$s", "mode": "normal", "ticket": ".scratch/$SLUG/issues/03-cli.md" }
      },
      "updatedAt": "2026-10-17T10:00:00Z"
    }
  }
}
JSON
}

# local_origin: a bare repository in TMPDIR as origin, holding main, so a push has somewhere to land.
local_origin() {
  local bare
  bare="$(mktemp -d)/origin.git"
  git init -q --bare "$bare"
  git remote add origin "$bare"
  git push -q origin main
}

# upstream: the installed mattpocock-skills copied into the workspace (readable inside the agent's
# sandbox) and registered in the run's config dir, then `skill-path.mjs --check` must say ok, or
# the scaffold fails. The source is found in your real home's registry (MATTPOCOCK_SKILLS_ROOT wins).
upstream() {
  local real_home src cfg version
  real_home="$(eval echo "~$(id -un)")"
  src="$(HOME="$real_home" node "$PLUGIN_ROOT/bin/skill-path.mjs" --root)"
  mkdir -p .upstream
  cp -R "$src/." .upstream/mattpocock-skills
  version="$(node -p 'require("./.upstream/mattpocock-skills/.claude-plugin/plugin.json").version')"
  cfg="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
  mkdir -p "$cfg/plugins"
  cat > "$cfg/plugins/installed_plugins.json" <<JSON
{ "version": 2, "plugins": { "mattpocock-skills@claude-plugins-official": [
  { "scope": "user", "installPath": "$PWD/.upstream/mattpocock-skills", "version": "$version" } ] } }
JSON
  env -u MATTPOCOCK_SKILLS_ROOT CLAUDE_CONFIG_DIR="$cfg" node "$PLUGIN_ROOT/bin/skill-path.mjs" --check > /dev/null
}
