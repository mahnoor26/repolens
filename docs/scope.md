# V1 scope and SRS mapping

The supplied document contains product requirements and examples of staged prompts. The examples are reference text, not separate user commands. This implementation follows the user's direct request to build the project.

| SRS area | Result |
| --- | --- |
| Repository path, stack detection, discovery, ignore patterns | Implemented |
| Standards discovery, .repolens.yml, hierarchy, rule configuration | Implemented, with narrow documented prose grammar |
| AST layer, dependency graph, registry, finding model | Implemented |
| React, TypeScript, architecture, accessibility | Implemented, with 24 built-in rules overall |
| Performance recommendations | Implemented for broad imports, render computations, Next.js images |
| CLI, JSON, HTML, score, source locations | Implemented |
| npm package layout, README, docs, examples, automated tests | Implemented |
| Git repository | Local repository initialized; no hosted remote created |
| CI | GitHub Actions workflow included; hosted runs require a GitHub remote |
| --fix and --changed | Explicit unsupported-feature errors; deferred by SRS V2 |
| AI, baselines, PR integration, monorepos, external plugins | Deferred by SRS V2 |

Selected implementation technologies: TypeScript Compiler API (an allowed SRS alternative), Commander, Zod, YAML, ignore, Node's test runner, and tsc. The package is ESM with type declarations. No dependency executes scanned repository code.

License and npm ownership remain undecided. This is a local V1 build, not a published release.
