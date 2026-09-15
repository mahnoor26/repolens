# Known limitations and roadmap

## V1 limits

- Syntax-based analysis does not run a TypeScript type checker. Unresolved names, overloaded imports, and shadowed symbols can affect heuristics. JSX inference is reported as inference when React is not declared.
- Root tsconfig options and path aliases are supported. `extends`, project references, monorepo package profiles, and bundler-specific resolution are not expanded; a report warning discloses inherited-config limits.
- Graphs include scanned local modules, not the internals of installed packages. Missing/excluded relative source imports generate warnings. Type-only edges appear in the graph but do not produce runtime cycles.
- Common React components, function declarations, arrow functions, memo-style wrappers, and classes are detected heuristically. This is not complete framework semantic analysis.
- Accessibility checks cover native JSX and common attributes; custom components, dynamic labels, focus behavior, contrast, and a full ARIA schema require other tools and manual review.
- Performance rules identify review candidates, not measured regressions. No bundle sizes are calculated.
- Prose conversion supports a small grammar. Use explicit YAML or repolens Markdown blocks for reliable policy enforcement.
- Local file reads are limited to 2 MB each. Invalid source aborts the audit rather than claiming success over an incomplete scan.
- AST cache is in memory when the API caller reuses `ASTAnalyzer`. No persistent disk cache or worker pool is implemented.
- Scores are weighted counts, not normalized by repository size. Confidence values are heuristic labels, not statistically calibrated probabilities.
- No auto-fix, baseline, changed-only scan, inline suppression, external plugin loading, AI provider, PR comments, or hosted service.

## V2 candidates from the SRS

1. Baselines with fingerprints robust to line movement and changed-file scanning with whole-repository dependency context.
2. Inherited tsconfig and workspace resolution, incremental disk cache, performance profiling.
3. Explicitly consented AI provider interface and validated policy extraction.
4. GitHub Action, PR summaries, and optional inline comments.
5. Packaged plugin system and narrowly scoped, opt-in safe fixes.

## Distribution still requires owner decisions

The project is locally packaged and includes CI configuration. Creating a hosted GitHub repository, choosing its owner/visibility, choosing a license, and selecting an available npm name are separate release decisions. Nothing has been published or uploaded.
