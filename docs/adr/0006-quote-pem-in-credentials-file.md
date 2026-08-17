# ADR-0006: Quote PEM values in credentials files

**Status**: Accepted  
**Date**: 2026-08-17

## Context

`buzz-team create` writes `credentials/<name>.env` for use with `source` in bash/zsh. The GitHub App private key is a multi-line PEM value stored as a single line with literal `\n` sequences. Without quoting, the line:

```
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIE...
```

is parsed by bash/zsh as an assignment of `-----BEGIN` followed by a command invocation of `RSA` (because the unquoted space after `=` terminates the value). The variable silently receives a truncated value.

## Decision

Wrap PEM values in single quotes in the credentials file:

```
GITHUB_APP_PRIVATE_KEY='-----BEGIN RSA PRIVATE KEY-----\nMIIE...'
```

Single quotes preserve literal `\n` (two chars) without shell expansion.

## Consequences

- `source credentials/<name>.env` now correctly sets the full key value.
- Consumers (entrypoint, Coder startup script) must handle the literal `\n` explicitly — either via `printf '%b'` to a temp file or `.replace(/\\n/g, '\n')` in Node.js.
- Any existing credentials file written before this fix has a truncated key and must be regenerated.
