# AGENTS.md Format

Plain Markdown, no required schema. Place at the repo root, next to `README.md`.

## Structure that works

```md
# AGENTS.md

## Commands
- Build: `...`
- Test: `...` (how to run a single test)
- Lint: `...`

## Directory structure
- `src/`: ...
- `docs/adr/`: ...

## Conventions
- Code style, naming, commit/PR format

## Boundaries
- Do not edit `infra/secrets/`
- Never commit credentials
```

Omit any section with nothing specific to say. A short file that's all true beats a long one padding out generic advice.

## Monorepo nesting

In a monorepo, agents use the **closest** `AGENTS.md` to the file being edited, falling back to the root file for anything it doesn't override. Put shared, repo-wide rules at the root; put package-specific commands and conventions (different test runner, different lint config) in that package's own `AGENTS.md`. Don't repeat root content in a nested file — nested files only need to state what differs.

## Anti-patterns to catch when auditing

- **Generic software advice.** "Write clean code," "handle errors gracefully" — an agent already knows this; it wastes tokens every turn.
- **Duplicated from README.** If `README.md` already states it for humans and it's equally true for agents, link to it instead of repeating it.
- **Stale commands.** A build/test command that no longer runs — verify by actually running it, don't take the prose on faith.
- **Broken path references.** A "do not edit X" or "see docs at Y" pointing at something that moved or was deleted.
- **Vague conventions.** "Follow existing patterns" says nothing actionable — name the actual pattern or drop the line.
- **Instructions that contradict the code.** E.g. stated formatter doesn't match the configured one — surface and resolve the contradiction, don't leave both standing.
