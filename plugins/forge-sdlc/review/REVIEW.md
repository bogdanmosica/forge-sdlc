# Bugs and security rubric

The rubric of the reviewer's **Bugs and security** axis. Apply every item to every hunk of the diff; a finding names the file and hunk, the item below, and a one-line fix.

## Labels

- **Important**: a defect the diff introduces or exposes; it blocks the merge until fixed.
- **Nit**: worth fixing, harmless to ship; listed, five at most, the most useful first, never blocks.

An item below is Important when the hunk can reach it at runtime or in a test run; a Nit when it is a hardening with no reachable failure.

## Bugs

- **Null paths**: a value that can be null, undefined, empty or missing (a lookup, a parsed input, an optional field, an empty list) used without a guard on the path the diff adds.
- **Floating promises**: an async call neither awaited, returned nor handled, so its failure is lost or its result races the caller.
- **Errors created, not thrown**: an error built and dropped, returned where the caller expects a throw, or caught and swallowed without a decision.
- **Dead branches**: a condition that is always true or always false, code after a return, a case no input reaches.
- **Tautological tests**: a test that passes whatever the code does: asserts the mock it set up, compares a value with itself, or has no assertion on the behaviour it names.
- **Hunks no test exercises**: changed behaviour with no test in the diff or the suite that would go red if the hunk were reverted.

## Security

- **Injection**: input reaching a shell command, query, template, path, regex or `eval` without parameters or escaping.
- **Unsafe navigation**: a redirect, URL, file path or link built from input without an allow-list (open redirect, path traversal, `javascript:` links).
- **Trust boundary**: data from a request, file, environment, model output or another service used as if validated: authorisation decided client-side, a type cast standing in for a check.
- **Data-access bypass**: a read or write that skips the layer the codebase uses to scope access (the repository, the policy check, the tenant filter).
- **Confidential logging**: personal data, credentials, tokens or full request bodies written to logs, errors, analytics or test snapshots.
- **Unexpected dependency**: a package, script source or remote call added that the spec does not ask for, or one pinned loosely, unmaintained, or fetched at runtime.

## Secrets

A credential **shape** in the diff is Important wherever it sits (code, test, fixture, config, docs): cloud access keys (`AKIA` prefixes, 40-character secret keys), `sk-` and `sk-ant-` API keys, `AIza` keys, `ya29.` tokens, `Bearer` headers, `private_key` fields and PEM private key blocks, `AccountKey=` and passwords inside connection strings, committed `.env` files.

The finding names the file, the line and the shape, and writes the value as `[REDACTED]`: the value is never quoted, in part or in full. The fix moves the value to an environment variable or the host's secrets manager; an example or fixture uses a placeholder that reads `<YOUR_API_KEY>` (or `<YOUR_DB_PASSWORD>`), never a realistic fake.

## Host extension

A host adds its own rules in `docs/agents/REVIEW.md`, in the same shape: items under these headings, or new headings. The host file extends this rubric and never relaxes it: every item here still applies, and a host rule that contradicts one is read as an addition beside it.
