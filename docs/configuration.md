# Configuration and standards

RepoLens looks for `.repolens.yml`, then `.repolens.yaml`. `--config` selects an explicit repository-relative file. Paths use `/` on every platform.

## Precedence, highest first

1. Company files listed in `standards.company`, in listed order (later fields win).
2. Explicit project configuration in `.repolens.yml`.
3. Project documents, in sorted path order (later fields win).
4. Framework and RepoLens defaults.

Rule fields (`enabled`, `severity`, `limit`) merge individually. Architecture arrays replace lower-layer arrays. `folders` maps merge by key. A company rule cannot be disabled through project `ignoreRules`; disable it explicitly in company policy. Company policy is authoritative for rule fields, but project `ignore` still determines scan scope; this local CLI is not a tamper-proof enterprise enforcement boundary.

## Discovery

Known names (case-insensitive): `BEST_PRACTICES.md`, `best-practices.md`, `CODING_STANDARDS.md`, `ENGINEERING_GUIDELINES.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `DEVELOPMENT_GUIDELINES.md`.

Other discovered Markdown is inspected for engineering standards/conventions keywords. `standards.paths` explicitly adds project documents. `standards.company` adds Markdown or YAML company files. Explicit paths bypass discovery ignore patterns but not containment, symlink, environment-file, or size restrictions.

## Supported prose

Examples of recognized, complete sentences:

```text
No any.
Don't use any.
Components should remain below 250 lines.
API calls belong in services.
API calls must be placed inside src/services.
React Query must be used for server state.
```

`services` maps to `src/services`; other API paths are used as written. Matching is anchored to a complete line, with optional Markdown bullets/numbering. Negated statements, ordinary fenced examples, and arbitrary natural language are not translated into policy. Unrecognized normative statements are listed in reports.

For exact configuration, use an explicit block:

````markdown
# Our standards
```repolens
rules:
  no-any:
    enabled: true
    severity: high
  component-max-lines:
    enabled: true
    limit: 200
architecture:
  apiDirectories: [src/data]
```
````

Company `.yml` files contain the same `rules` and `architecture` shape. Other configuration keys are not accepted inside policy documents.

## Architecture

```yaml
architecture:
  apiDirectories: [src/services]
  componentDirectories: [src/components]
  hookDirectories: [src/hooks]
  folders:
    components: src/components
    services: src/services
    hooks: src/hooks
    utils: src/utils
  forbiddenImports:
    - from: src/services
      to: src/components
```

By default, network calls belong in `src/services` and service → component dependencies are forbidden. The API rule checks all scanned source files outside allowed directories, despite its compatibility ID `no-api-in-components`. Directory matching respects boundaries: `src/services-old` is not inside `src/services`.

Configured `folders` must contain scanned sources. Explicit folder policy checks reusable component and standalone custom-hook placement. Framework `app/` and `pages/` routes and component test/story files are exempt from component placement. This is a narrow placement check, not a complete domain architecture validator.

## Rules and scoring

Run `repolens --list-rules` for valid keys. All rules are enabled by default except `explicit-return-types` and `server-state-query` (the latter is activated by its recognized policy phrase).

Limits: component lines default 250; assertions per file default 5; component hook count default 6 (requires a network call too). `limit` must be a positive integer. Rules without a threshold ignore this shared option.

Score = `max(0, round(100 − Σ count[severity] × weight[severity]))`. Defaults: critical 15, high 8, medium 3, low 1, info 0. Custom weights are finite, nonnegative numbers. This deliberately simple score is not normalized by repository size and can reach zero in a large repository.

## Ignore semantics

Built-in directories: `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, `.turbo`, `.cache`. Symlinks, `.env*`, and declaration files are excluded. Root `.gitignore` and config `ignore` use gitignore-style syntax. Nested `.gitignore` files are not expanded in V1. An ignored parent is not traversed; negate parent directories as well when re-including descendants. Explicit rule configuration is preferred over code comments; inline suppressions are not implemented.

The skipped count is a count of encountered entries (including pruned directories), not a recursive count of every file under those directories.
