# RepoLens

**Turn engineering standards into executable rules.**

RepoLens is a local React/TypeScript repository auditor. It combines AST checks, module dependency analysis, and project/company policy to produce actionable findings in the terminal, JSON, and a standalone HTML report.

**Status:** V1 implementation, version `0.1.3`. This repository is ready for local use and packaging. It has not been published to npm or GitHub. The npm name is a placeholder until availability and ownership are confirmed. License remains undecided (`UNLICENSED`), as specified in the brief.

## Quick start

Requires Node.js 20 or later and npm.

```powershell
cd D:\RepoLens
npm ci
npm test
npm run demo
```

Open `demo-report.html` in a browser. The demo deliberately contains violations; its source is a scan fixture, not a runnable React app. `examples/clean` demonstrates a passing repository.

### Audit your repository

```powershell
node D:\RepoLens\dist\cli.js D:\path\to\your-react-app --verbose
node D:\RepoLens\dist\cli.js D:\path\to\your-react-app --json
node D:\RepoLens\dist\cli.js D:\path\to\your-react-app --html report.html
```

### Create your project's rules file

```powershell
npx --no-install repolens . --init
```

This creates a heavily commented `.repolens.yml` in the project. Open it in any editor and change `enabled`, `severity`, and `limit` values. RepoLens will never overwrite an existing rules file.

For a local `repolens` command:

```sh
npm link
repolens ./your-app --html report.html
```

Do not use bare `npx repolens` to try this unpublished implementation: that could fetch an unrelated package. To test the actual distributable, run `npm pack` and install the resulting local `.tgz` in a disposable directory.

## What V1 includes

- React/TypeScript, Next.js, dependency, styling, and tooling detection.
- Safe source discovery with built-in exclusions, root `.gitignore`, and custom ignore patterns.
- TypeScript Compiler API analysis; source text is parsed, never executed.
- 24 rules across React, TypeScript, architecture, accessibility, and performance.
- Dependency graph including relative imports, root tsconfig aliases, re-exports, dynamic imports, and CommonJS `require` with literal paths.
- Company → project → framework/default policy precedence, validated YAML, explicit Markdown policy blocks, and conservative prose recognition.
- File/line/column findings, stable IDs, severity, explanations, recommendations, policy evidence, and confidence.
- Configurable weighted engineering score and CI failure threshold.
- Terminal and JSON output; responsive HTML report with search, filters, expandable evidence, and print styles.
- Public TypeScript API and an in-process custom rule registry.
- Automated positive, negative, edge-case, integration, CLI, and security tests; CI configuration for Node 20/22 on Windows/Linux.

## CLI

```text
repolens [repository]
  --config <path>         YAML config, relative to the audited repository
  --init                  Create a commented .repolens.yml for project owners to edit
  --json                  JSON on stdout (diagnostics stay on stderr)
  --html [path]           Standalone HTML; defaults to repolens-report.html
  --overwrite             Explicit permission to replace an existing HTML output
  --verbose               Include explanations, policy evidence, and confidence
  --color <mode>          Terminal colors: auto, always, or never
  --fail-on <severity>    critical | high | medium | low | info | none
  --list-rules            List built-in rule IDs; supports --json
  --help                  Usage
  --version               Version
```

The repository argument should precede `--html`, since the optional HTML path can otherwise consume it. Output paths are relative to the working directory; configuration and policy paths are relative to the audited repository. Configuration paths must remain inside it and use forward slashes.

Exit codes: **0** audit completed and threshold not exceeded; **1** findings meet/exceed the threshold; **2** input, configuration, output, or analysis error. Default `failOn` is `none`, so a review can complete successfully even with findings. Use `--fail-on high` for CI.

Color is automatic in interactive terminals such as VS Code. Use `--color always` to force it, `--color never` for plain output, or set `NO_COLOR=1` to disable automatic color. JSON is always plain and safe for machines.

`--fix` and `--changed` return a clear unsupported-feature error. They are V2 features in the SRS, not silently ignored flags.

## Configuration

Create `.repolens.yml` in the audited repository:

```yaml
project:
  framework: react
  language: typescript
standards:
  paths: [BEST_PRACTICES.md, docs/engineering.md]
  company: [docs/company-policy.yml]
rules:
  component-max-lines:
    enabled: true
    limit: 250
    severity: medium
  no-any:
    enabled: true
    severity: high
  explicit-return-types:
    enabled: false
architecture:
  apiDirectories: [src/services]
  componentDirectories: [src/components]
  hookDirectories: [src/hooks]
  forbiddenImports:
    - from: src/services
      to: src/components
ignore: [generated/, legacy/]
ignoreRules: [large-imports]
score:
  weights:
    critical: 15
    high: 8
    medium: 3
    low: 1
    info: 0
failOn: high
```

Referenced files must exist; remove optional `standards` entries you do not use. Unknown keys, unknown rules, malformed YAML, negative weights, and invalid limits fail with an error.

See [configuration and standards](docs/configuration.md), [rule reference](docs/rules.md), and [architecture](ARCHITECTURE.md).

## Programmatic API

```ts
import { audit, htmlReport, ASTAnalyzer, RuleRegistry } from 'repolens';

const analyzer = new ASTAnalyzer();
const report = audit('./my-app', { analyzer });
console.log(report.score, report.findings);
const html = htmlReport(report);
// Reuse analyzer on subsequent audits for content-based AST caching.
```

Custom `Rule` objects can be registered explicitly via `new RuleRegistry().register(rule)` and passed to `audit(root, { registry })`. Repository config cannot load JavaScript plugins. Custom rule code supplied by an API caller executes in that caller's process and must be trusted.

## Safety and limits

Core audits perform no network requests, telemetry, AI uploads, or source modifications. Repository JavaScript/config scripts and package scripts are never executed. Source symlinks/junctions and `.env*` files are skipped. Reads are bounded to 2 MB per file, and reports escape repository-controlled content. HTML uses a content security policy and no remote assets.

This is a syntax-based auditor, not a replacement for TypeScript, ESLint, runtime tests, or an accessibility review. Heuristic findings carry confidence values; they are not calibrated probabilities. A score of 82 is a configured weighted signal, not “82% good.” See [known limitations](docs/limitations.md).

## Development

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run demo
npm pack --dry-run
```

`src/` contains the implementation; `tests/` has all rule and integration checks. The test launcher uses Node's built-in test framework in-process so it also works where subprocess isolation is unavailable. The compiled CLI and library live in `dist/`.

The original supplied brief is preserved as [SRS.md](SRS.md). [V1 scope](docs/scope.md) maps implementation decisions and future features to the brief.
