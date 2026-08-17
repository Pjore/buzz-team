# SKILL.md Format

A Skill is a folder with a required `SKILL.md` plus optional `scripts/`, `references/`, `assets/`. Only `SKILL.md`'s frontmatter is loaded up front; the body and any referenced files load only when the skill is invoked. That makes the `description` the single most important thing you write — it's the only signal deciding whether the skill fires at all.

## Frontmatter

```yaml
---
name: kebab-case-name
description: <what it does> + <when to use it>, with concrete trigger phrases
---
```

## Writing the `description`

- **Say what it does AND when to use it**, both in one field — not just a category label. "Formats code" is useless; "Formats Python files with black; use before committing or when asked to lint" is not.
- **Include trigger phrases** the user is likely to actually say, e.g. this repo's `grilling` skill: "Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases." That phrase-matching is what makes implicit invocation reliable.
- **Front-load the distinguishing part.** The model scans many descriptions at once; bury the trigger condition and it gets skipped over.
- **Don't describe internal steps here** — that's the body's job. The description's only job is discovery.

## Body

- Assume the reader is another agent instance, not a human being onboarded. Skip preamble; open with the first instruction.
- Match freedom to the task: step-by-step only where strict adherence matters; heuristics and examples where judgment is expected.
- Push anything long, templated, or rarely needed into `references/`, `scripts/`, `assets/` and link to it — don't inline it.

## Anti-patterns to catch when auditing

- **Vague description.** No trigger condition, so implicit invocation never fires — the skill exists but nothing ever calls it.
- **Explaining basics.** Teaching what a concept is, rather than the project/task-specific way to handle it.
- **Everything inlined.** Long reference tables or full script listings in the body instead of a linked file — this cost is paid even when only a small part is needed.
- **Body duplicating the description**, or vice versa — say the "when" once, in the description.
- **`disable-model-invocation` used as a workaround** for a weak description, instead of fixing the description itself.
