# RepoLens architecture

## Data flow

```text
CLI / public API
    → validated YAML configuration
    → safe repository discovery and stack profile
    → company/project standards resolution
    → parsed source files + dependency graph
    → rule registry and deterministic execution
    → normalized findings + weighted score
    → terminal / JSON / standalone HTML
```

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `types.ts` | Project, policy, finding, report, graph, rule, and context contracts |
| `repository.ts` | Bounded local reads, path containment, exclusions, source and Markdown discovery, stack detection |
| `config.ts` | Strict Zod schemas, safe YAML parsing, configuration loading |
| `standards.ts` | Policy discovery, supported prose, explicit blocks, precedence, unsupported statements |
| `analyzer.ts` | AST parse/cache, reusable traversal and source locations, import resolution and graph |
| `rules-*.ts` | Pure check functions grouped by category |
| `rule-helpers.ts` | Common finding, JSX, and directory helpers |
| `engine.ts` | Rule registration, configuration resolution, deterministic findings, scoring, failure thresholds |
| `reporters.ts` | Terminal sanitization, JSON, escaped HTML and client-side filters |
| `cli-main.ts` | Argument parsing and I/O orchestration with an explicit exit code |
| `cli.ts` | Executable entry point only |
| `index.ts` | Public library exports |

## Decisions

- **Single package:** keeps V1 development and distribution simple; categories can be split into packages later.
- **TypeScript Compiler API:** supported by the SRS; avoids a second AST abstraction and uses TypeScript's module resolution. ASTs are cached by absolute file path plus content within a reusable analyzer instance.
- **Commander, Zod, YAML, ignore:** focused libraries for parsing and validation. The built-in Node test framework and `tsc` replace optional Vitest/tsup choices without adding runtime features.
- **No repository execution:** no dynamic imports of target modules, no package scripts, no target plugin/config execution. Discovery skips symlinks and environment files. Module resolution uses a bounded custom filesystem host.
- **Policy as data:** repository YAML and explicit Markdown blocks map to registered rules only. Unknown IDs fail. Recognized prose is intentionally narrow and unsupported requirements remain visible.
- **Company precedence:** company documents are applied after project config. Rule fields merge, architecture lists replace, and folder maps merge. `ignoreRules` cannot override company-owned rules.
- **Deterministic execution:** ASTs are parsed once per file, rules run sequentially, and findings sort by severity/file/location/rule. Parsing failures abort instead of yielding a misleading clean score.
- **Dependency cycles:** iterative DFS emits cycle witnesses for back edges; type-only imports are excluded. This avoids recursion overflow and exponential enumeration of every possible cycle.
- **No AI coupling:** V1 returns deterministic findings. The source model reserves `ai` for a future explicitly consented provider layer.

## Testing strategy

Each built-in rule has a positive, negative, and unusual-valid case. Additional integration cases cover policy precedence, input validation, alias resolution, cycles, caching, CLI return codes and output, source locations, ignored paths, symlinks, and report injection. CI runs the same suite across Windows/Linux and Node 20/22. Browser smoke verification covers report filtering and layout.

## Technical references

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [YAML parser documentation](https://eemeli.org/yaml/)

## Extension path

V2 can add baseline fingerprints, changed-file selection with whole-graph awareness, persistent caches, a separately consented AI provider, workspace-specific profiles, and packaged plugins. These features must not compromise the deterministic local audit path.
