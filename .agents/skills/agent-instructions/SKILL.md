---
name: agent-instructions
description: Write and audit AI agent instructions — AGENTS.md and Agent Skills (SKILL.md). Use when creating or updating AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, or any SKILL.md, or when the user asks how to structure instructions for an AI coding agent.
---

# Agent Instructions

Both artifacts exist to change agent behavior with as few tokens as possible. Everything you write competes for space in the same context window as the code itself — treat every line as a cost, not a courtesy.

## Core rules

- **Only state what the agent couldn't infer.** Don't explain what a `.gitignore` is or that tests should pass. State the project's specific, non-obvious facts: the actual test command, the actual lint config, the actual branch convention.
- **Write for the reader, not for humans.** No onboarding tone, no encouragement, no filler transitions. A checklist beats a paragraph.
- **Keep it current or delete it.** An instruction that lies is worse than no instruction — the agent will follow it and fail. When auditing, verify claims against the repo (run the stated command, check the referenced path exists) rather than trusting the prose.
- **Edit inline, immediately**, the moment you spot a stale or wrong instruction — don't batch fixes for later, and don't just propose them: fix them and note what you changed.
- **Keep every file 150–450 words**, excluding frontmatter. Below 150 there's usually not enough to justify a separate file; above 450 it belongs in a linked reference instead of the main body.

## AGENTS.md vs. a Skill

Put it in **AGENTS.md** when it's always true and cheap to state: build/test commands, directory layout, style conventions, do-not-touch paths. Put it in a **Skill** when it's a situational, multi-step workflow that shouldn't load unless relevant — its `description` is the trigger, its body is only paid for when invoked. If a paragraph in AGENTS.md only matters for one kind of task, it's a Skill candidate, not a permanent cost every turn pays.

## Not the domain glossary

`AGENTS.md`/Skills are operational: commands, workflow, conventions. A project's `CONTEXT.md` (see the `domain-modeling` skill) is purely a vocabulary glossary with zero implementation detail. Never let domain terminology leak into AGENTS.md, and never let build commands leak into CONTEXT.md.

## Legacy formats

`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md` are vendor-specific predecessors of the same idea. Prefer `AGENTS.md` for new projects; when one of these already exists, apply the same rules to it rather than forking content across files.

## Details

- [references/AGENTS-FORMAT.md](./references/AGENTS-FORMAT.md) — structure, monorepo nesting, anti-patterns
- [references/SKILL-FORMAT.md](./references/SKILL-FORMAT.md) — structure, writing the `description`, anti-patterns
