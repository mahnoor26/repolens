# Rule reference

Every finding includes a rule ID, severity, category, file, source location where available, explanation, recommendation, policy source, and confidence. IDs use descriptive names in configuration; SRS identifiers are mapped below.

| SRS | Rule ID | Default | Detection |
| --- | --- | --- | --- |
| R001 | `missing-key` | medium | JSX/fragment returned from inline map callback lacks a key |
| R002 | `derived-state` | low | useState directly copies a component prop |
| R003 | `derived-effect` | low | Effect consists only of a synchronous setter call |
| R004 | `component-max-lines` | medium | Component declaration exceeds 250 lines |
| R005 | `component-responsibilities` | low | Component has more than 6 hook-like calls and network access |
| STATE001 | `server-state-query` | high, opt-in | Effect contains network access and local state setter |
| T001 | `no-any` | high | Explicit `any` AST node |
| T002 | `excessive-assertions` | medium | More than 5 assertions per file; excludes `as const` |
| T003 | `explicit-return-types` | medium, opt-in | Directly exported functions/arrows lack return annotations |
| T004 | `duplicate-types` | low | Same simple primitive object shape across files |
| T005 | `unsafe-typescript` | medium | Non-null assertions and ts-ignore/ts-nocheck directives |
| A001 | `no-api-in-components` | high | fetch, imported axios, or XMLHttpRequest outside API directories |
| A002 | `import-direction` | high | Resolved dependency violates configured from/to directory boundary |
| A003 | `circular-dependencies` | high | Cycle witnesses in runtime module graph |
| A004 | `folder-convention` | medium | Configured folder use and explicit component/hook placement |
| Accessibility | `image-alt` | medium | Native img without alt (empty alt allowed) |
| Accessibility | `semantic-button` | medium | Clickable non-control lacks semantics/keyboard support |
| Accessibility | `form-label` | medium | Native input/select/textarea lacks a detectable label |
| Accessibility | `nested-interactive` | medium | Control inside a native link/button |
| Accessibility | `aria-misuse` | medium | Common boolean ARIA misuse or hidden focusable control |
| Accessibility | `accessible-name` | medium | Native link/button lacks detectable text/name |
| Performance | `large-imports` | low | Broad lodash or moment import needs bundle review |
| Performance | `render-computation` | low | JSON.parse or sort directly during component render |
| Performance | `next-image` | low | Native image in Next.js may benefit from next/image |

Heuristics intentionally produce recommendations. JSX spread attributes and many dynamic values are treated as unknown to avoid claiming a definite missing attribute. Components wrapped in unfamiliar higher-order functions, alias chains, custom API clients, and custom accessibility components may not be recognized. Duplicate types are limited to at least two primitive properties and exclude generics/extends to avoid conflating unrelated references.

## Example custom rule

```ts
import { audit, RuleRegistry, type Rule } from 'repolens';

const requireServices: Rule = {
  id: 'team-services',
  name: 'Service layer exists',
  description: 'This team expects a service layer.',
  category: 'architecture',
  severity: 'medium',
  appliesTo: () => true,
  check: context => context.files.some(f => f.path.startsWith('src/services/')) ? [] : [{
    file: 'src/services',
    message: 'No service source files found.',
    explanation: 'This project expects a service layer.',
    recommendation: 'Add the layer or revise the policy.',
    confidence: 1,
  }],
};

const registry = new RuleRegistry().register(requireServices);
const report = audit('./app', { registry });
```

Custom rules are explicitly supplied by a trusted API caller, never loaded from a scanned repository. Packaged plugin discovery is deferred to V2.
