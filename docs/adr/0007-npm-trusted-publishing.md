# Publish buzz-team CLI to the public npm registry via trusted publishing

The `buzz-team` CLI is published unscoped to the public npm registry, and CI authenticates to npm using OIDC trusted publishing rather than a stored `NPM_TOKEN` secret.

## Considered Options

- **GitHub Packages npm registry**: keeps everything inside GitHub, but requires every consumer to configure a `.npmrc` with a GitHub token even to install a public package. That breaks the goal of a frictionless `npx buzz-team@latest` with no setup.
- **Public npm registry + classic automation token** (`NPM_TOKEN` secret): simple and well understood, but a long-lived write credential sits in repo secrets indefinitely, can leak via logs/misconfiguration, and needs manual rotation.
- **Public npm registry + OIDC trusted publishing** (chosen): CI exchanges a short-lived, workflow-scoped OIDC token for a publish token on every run — no long-lived npm credential exists anywhere. Also yields automatic provenance attestations for the package. Trade-off: trusted publishing can only be configured on an npm package that already exists, so the very first release must be published manually (`npm publish` from an authenticated local machine) before the trusted publisher link can be added in the package's npm settings.

## Consequences

- The package is unscoped `buzz-team` (confirmed available) — installable via `npx buzz-team@latest` with no scope or registry override.
- No `NPM_TOKEN` (or any npm credential) exists in repository secrets. `.github/workflows/publish-cli.yml` requests `id-token: write` and lets npm's CLI negotiate OIDC automatically.
- Bootstrapping a new major distribution channel required one manual, out-of-band step: publishing v0.1.0 by hand, then registering GitHub Actions as this package's trusted publisher (org `Pjore`, repo `buzz-team`, workflow file `publish-cli.yml`) on npmjs.com.
- The publish workflow triggers on push to `main` when `src/cli/**` changes, and is a no-op unless `package.json`'s version differs from what's currently published — version bumps are still manual, mirroring how this repo already versions Docker images.
