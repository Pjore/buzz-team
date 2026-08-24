# Persona files are pushed by the CLI, never templated through Coder parameters

`AGENTS.md`/`SOUL.md` were originally passed as `agents_md`/`soul_md` Coder template parameters and baked into `docker_container.env` at creation time — any persona edit forced Terraform to recreate the whole container (env diff → force-replace), losing the rest of the workspace's state for what should be a one-line prompt tweak. We removed both parameters entirely; `buzz-team workspace soul push <name>` now copies the files directly into the running container (`coder ssh` + restart `buzz-acp`), decoupling persona edits from infrastructure state.

## Considered Options

- **Keep parameters, accept recreate** — simplest, fully declarative, but every persona edit is a full workspace rebuild.
- **Direct push, no Terraform involvement** (chosen) — instant, no rebuild, but Coder/Terraform state no longer reflects the live persona content.

## Consequences

- A workspace's `AGENTS.md`/`SOUL.md` can drift from whatever Terraform last knew about — invisible to `coder show`/`terraform plan`. This is accepted, not reconciled.
- `workspace create` must call `soul push` as its own final step (new workspaces have no persona files until it runs) — persona is never present at first boot from the image/template alone.
