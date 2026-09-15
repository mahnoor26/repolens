Absolutely. Since you're planning to build this with **ChatGPT Plus + Codex**, I would write the SRS in a way that is not just academic documentation, but also acts as the **master specification that Codex can implement against**.

One important decision: **V1 should focus on React + TypeScript repositories**. Don't try to support every language/framework initially.

# Software Requirements Specification (SRS)

## Project: RepoLens

**Version:** 1.0
**Product Type:** Developer Tool / npm Package / CLI
**Primary Platform:** Node.js
**Target Repositories:** React + TypeScript
**Distribution:** npm
**License:** To be decided
**Status:** Planned

---

# 1. Product Overview

## 1.1 Product Name

**RepoLens**

### Tagline

> **Turn engineering standards into executable rules.**

---

## 1.2 Product Vision

RepoLens is a repository-aware engineering standards and code-quality auditing tool.

It analyzes an existing software repository, understands its technology stack and architecture, discovers organization-specific engineering standards, and evaluates the codebase against those standards.

If organization-specific standards are unavailable, RepoLens applies a configurable set of React, TypeScript, accessibility, architecture, maintainability, and performance best practices.

The system provides developers with:

* violations
* recommendations
* severity
* affected files
* exact locations
* explanations
* suggested improvements
* overall engineering score
* HTML/JSON/CLI reports

The system may optionally use AI to analyze problems that cannot be reliably identified through deterministic static analysis.

---

# 2. Problem Statement

Software companies often have engineering standards such as:

```text
API calls must live in services/
Components should not exceed X lines
Use React Query for server state
Don't use any
Use specific folder structures
Follow naming conventions
Use specific state-management patterns
Follow testing requirements
```

However, these rules are usually stored in:

```text
README.md
BEST_PRACTICES.md
CONTRIBUTING.md
Engineering Guidelines
Internal documentation
```

The problem is that these standards are often **documentation rather than executable rules**.

A developer may violate them without realizing it.

Existing tools such as linters can detect syntax and predefined code-quality issues, but they generally do not understand:

> **"What are THIS company's engineering standards?"**

RepoLens addresses this gap.

---

# 3. Goals

## 3.1 Primary Goals

RepoLens must:

1. Scan a repository.
2. Identify the technology stack.
3. Understand the repository structure.
4. Discover company/project engineering standards.
5. Convert supported standards into machine-readable rules.
6. Analyze React/TypeScript code.
7. Apply organization-specific rules.
8. Apply default best practices when company standards are unavailable.
9. Generate actionable findings.
10. Explain why a finding matters.
11. Provide recommendations.
12. Generate a repository health score.
13. Support CLI execution.
14. Generate JSON reports.
15. Generate HTML reports.
16. Be extensible through a rule/plugin architecture.
17. Eventually support GitHub PR integration.

---

# 4. Non-Goals for V1

V1 will **not** attempt to:

* support every programming language
* replace ESLint
* replace TypeScript compiler errors
* guarantee detection of AI-generated code
* automatically rewrite the entire repository
* understand every natural-language company policy
* make architectural decisions without evidence
* modify source files automatically by default
* act as a complete SaaS application

These may be future features.

---

# 5. Target Users

## 5.1 Software Developers

Use RepoLens before submitting code.

```bash
npx repolens
```

---

## 5.2 Tech Leads

Use it to enforce architecture and engineering standards.

---

## 5.3 Engineering Managers

Use reports to understand repository quality.

---

## 5.4 Software Houses

Define company-wide standards and apply them across projects.

---

## 5.5 Open Source Maintainers

Define project contribution standards.

---

# 6. Primary Use Cases

## UC-01: Scan Repository

User executes:

```bash
npx repolens
```

System:

1. Detects repository.
2. Detects framework.
3. Detects language.
4. Detects dependencies.
5. Scans supported source files.
6. Executes applicable rules.
7. Generates report.

---

# 7. UC-02: Detect Technology Stack

RepoLens analyzes:

```text
package.json
tsconfig.json
vite.config.*
next.config.*
eslint.config.*
```

Example output:

```text
Framework:
  React 19

Meta-framework:
  Next.js

Language:
  TypeScript

State:
  Redux Toolkit
  React Query

Styling:
  Tailwind CSS
```

---

# 8. UC-03: Detect Company Standards

RepoLens searches for:

```text
BEST_PRACTICES.md
best-practices.md
CODING_STANDARDS.md
ENGINEERING_GUIDELINES.md
ARCHITECTURE.md
CONTRIBUTING.md
DEVELOPMENT_GUIDELINES.md
```

It should also scan relevant Markdown documentation for keywords such as:

```text
coding standards
engineering standards
best practices
architecture
conventions
guidelines
```

---

# 9. UC-04: No Standards Found

If no company/project standards are discovered:

```text
⚠ No organization-specific standards found.

RepoLens will use:
✓ React recommendations
✓ TypeScript recommendations
✓ Accessibility recommendations
✓ Architecture recommendations
✓ Performance recommendations
```

---

# 10. UC-05: Analyze Against Company Standards

Example:

Company standard:

```text
API calls must be placed inside src/services.
```

Repository:

```text
src/components/UserProfile.tsx
```

contains:

```ts
fetch("/api/users");
```

RepoLens reports:

```text
HIGH
Architecture Violation

Rule:
API calls must be located inside src/services.

File:
src/components/UserProfile.tsx

Line:
42

Recommendation:
Move API logic to:

src/services/userService.ts
```

---

# 11. UC-06: React Best-Practice Analysis

RepoLens should initially support rules including:

### R001 — Missing React key

Detect:

```tsx
items.map(item => <Item />)
```

without a key.

---

### R002 — Suspicious derived state

Detect unnecessary state/effect combinations.

---

### R003 — Suspicious useEffect

Identify common cases where `useEffect` is being used to derive values that can be calculated directly.

---

### R004 — Oversized component

Detect components exceeding configured line threshold.

Default:

```text
250 lines
```

This must be configurable.

---

### R005 — Excessive component responsibilities

Use deterministic heuristics initially.

AI analysis may supplement this later.

---

# 12. TypeScript Rules

Initial rules:

### T001 — Explicit `any`

```ts
const data: any
```

---

### T002 — Excessive type assertions

```ts
data as User
```

---

### T003 — Missing return types where configured

Optional rule.

---

### T004 — Duplicate type definitions

Detect potentially duplicated interfaces/types.

---

### T005 — Unsafe patterns

Identify configurable unsafe TypeScript patterns.

---

# 13. Architecture Rules

## A001 — API Location

Configurable:

```yaml
apiDirectories:
  - src/services
```

---

## A002 — Import Direction

Example:

```text
components → services
services → API
```

But:

```text
services → components
```

could be forbidden.

---

## A003 — Circular Dependencies

Build dependency graph:

```text
A → B
B → C
C → A
```

Report:

```text
HIGH

Circular dependency detected:
A → B → C → A
```

---

## A004 — Folder Convention

Company can define:

```yaml
folders:
  components: src/components
  services: src/services
  hooks: src/hooks
  utils: src/utils
```

RepoLens verifies usage.

---

# 14. Accessibility Rules

Initial rules:

* missing image `alt`
* button implemented as inappropriate element
* missing form labels
* invalid interactive elements
* basic ARIA misuse
* missing accessible names

---

# 15. Performance Rules

Initial recommendations:

* unnecessarily large imports
* suspicious rendering patterns
* expensive computation inside render
* obvious repeated calculations
* oversized bundle-related imports
* image optimization recommendations where applicable

These should generally be **recommendations**, not absolute violations.

---

# 16. Standards System

This is the core differentiator.

RepoLens needs a standard hierarchy.

```text
Company Standards
        ↓
Project Standards
        ↓
Framework Defaults
        ↓
RepoLens Defaults
```

Higher-level rules override lower-level rules.

---

# 17. `.repolens.yml`

Users can explicitly configure RepoLens.

Example:

```yaml
project:
  framework: react
  language: typescript

standards:
  paths:
    - BEST_PRACTICES.md
    - docs/engineering.md

rules:
  component-max-lines:
    enabled: true
    limit: 250
    severity: medium

  no-any:
    enabled: true
    severity: high

  no-api-in-components:
    enabled: true
    severity: high

architecture:
  apiDirectories:
    - src/services

  componentDirectories:
    - src/components

  hookDirectories:
    - src/hooks
```

---

# 18. Rule Model

Every rule must follow a common interface.

Conceptually:

```ts
interface Rule {
  id: string;
  name: string;
  description: string;

  category:
    | "react"
    | "typescript"
    | "architecture"
    | "accessibility"
    | "performance";

  severity:
    | "critical"
    | "high"
    | "medium"
    | "low"
    | "info";

  appliesTo(project: ProjectProfile): boolean;

  check(context: AnalysisContext): Finding[];
}
```

---

# 19. Finding Model

```ts
interface Finding {
  id: string;
  ruleId: string;

  severity:
    | "critical"
    | "high"
    | "medium"
    | "low"
    | "info";

  category: string;

  file: string;

  line?: number;
  column?: number;

  message: string;

  explanation?: string;

  recommendation?: string;

  source:
    | "company"
    | "project"
    | "framework"
    | "repolens"
    | "ai";

  confidence?: number;
}
```

---

# 20. Rule Severity

### Critical

Potential security/architecture issue requiring immediate attention.

### High

Strong violation of company/project standards.

### Medium

Maintainability or quality concern.

### Low

Minor recommendation.

### Info

Educational recommendation.

---

# 21. AST Analysis

RepoLens should use AST-based analysis instead of relying primarily on regular expressions.

Recommended technology:

```text
TypeScript Compiler API
```

or:

```text
ts-morph
```

The AST layer should expose:

```ts
ASTAnalyzer
```

which can provide:

* functions
* components
* imports
* exports
* hooks
* JSX
* variables
* calls
* dependencies
* types
* interfaces

---

# 22. Repository Dependency Graph

RepoLens should build:

```text
Module A
   ↓
Module B
   ↓
Module C
```

Representation:

```ts
interface DependencyGraph {
  nodes: Module[];
  edges: DependencyEdge[];
}
```

This enables:

* circular dependency detection
* architecture validation
* dependency analysis
* import-direction rules

---

# 23. AI Analysis

AI should be **optional**.

The core audit must work without an LLM.

AI can analyze:

* architectural smells
* component responsibility
* unclear business logic
* potential refactoring opportunities
* natural-language company policies

Example:

```text
AI Analysis

UserDashboard.tsx appears to contain:

1. API fetching
2. Permission logic
3. Filtering
4. Export functionality
5. UI rendering

Suggested decomposition:
- useUserDashboard()
- UserFilters
- ExportActions
- DashboardView
```

AI findings must clearly be marked:

```text
Source: AI
Confidence: 87%
```

---

# 24. Natural Language Standards

Future functionality:

Input:

```text
API calls should never happen directly inside UI components.
```

AI converts to:

```json
{
  "category": "architecture",
  "rule": "no-api-in-components",
  "target": "component",
  "forbiddenOperations": [
    "fetch",
    "axios",
    "XMLHttpRequest"
  ]
}
```

Before activation, RepoLens should validate the generated rule.

---

# 25. CLI Requirements

Primary command:

```bash
npx repolens
```

Supported:

```bash
repolens .
repolens ./project
repolens --config .repolens.yml
repolens --json
repolens --html
repolens --fix
repolens --changed
repolens --verbose
```

---

# 26. CLI Output

Example:

```text
RepoLens v1.0

Scanning repository...

✓ Project detected
✓ React detected
✓ TypeScript detected
✓ Company standards found

Files scanned: 247
Files skipped: 31

Engineering Score: 82/100

Critical: 2
High: 7
Medium: 18
Low: 31
```

---

# 27. JSON Output

```bash
repolens --json
```

Output:

```json
{
  "project": {},
  "score": 82,
  "findings": [],
  "statistics": {},
  "standards": {}
}
```

This allows CI systems and other tools to consume RepoLens.

---

# 28. HTML Report

Generate:

```text
repolens-report.html
```

Sections:

```text
Overview
Technology Stack
Engineering Score
Standards
Violations
React
TypeScript
Architecture
Accessibility
Performance
AI Recommendations
```

Each finding should provide:

```text
Rule
File
Line
Severity
Explanation
Recommendation
Source
Confidence
```

---

# 29. Scoring System

Initial formula:

```text
100
-
weighted violations
=
score
```

Example weights:

```text
Critical = 15
High = 8
Medium = 3
Low = 1
```

However, score calculation should be configurable.

Avoid claiming that:

> 82/100 = objectively 82% good.

Call it:

> **RepoLens Engineering Score**

---

# 30. Ignore System

Users must be able to ignore:

```text
node_modules
dist
build
.next
coverage
.git
```

and custom directories:

```yaml
ignore:
  - generated/
  - legacy/
  - vendor/
```

Specific rules can also be ignored:

```yaml
ignoreRules:
  - component-max-lines
```

---

# 31. Baseline Support

This is a very useful professional feature.

Existing repository may have:

```text
500 violations
```

The company doesn't want CI to fail immediately.

RepoLens can create:

```text
.repolens-baseline.json
```

Then CI only fails when **new violations are introduced**.

Example:

```text
Existing violations: 500
New violations: 2

❌ PR introduces 2 new violations.
```

This should be a V2 feature but is highly valuable.

---

# 32. GitHub Integration

Future GitHub Action:

```yaml
- uses: repolens/action@v1
```

It should:

1. Analyze changed files.
2. Compare against baseline.
3. Run company standards.
4. Generate PR summary.
5. Optionally create inline comments.
6. Fail CI based on configured thresholds.

---

# 33. Monorepo Support

Future:

```text
apps/
  web/
  admin/

packages/
  ui/
  shared/
```

RepoLens should eventually understand workspace boundaries.

---

# 34. Security Requirements

RepoLens must:

* never execute repository source code during static analysis
* safely parse files
* avoid arbitrary command execution
* avoid sending source code to AI without explicit user consent
* clearly disclose AI data transmission
* never expose environment variables
* never read `.env` contents by default
* sanitize generated reports

---

# 35. Privacy

Default behavior:

> **100% local analysis.**

Source code should remain on the developer's machine unless the user explicitly enables an AI provider.

If AI is enabled:

```text
⚠ AI analysis may send selected source/context
to the configured provider.
```

This is particularly important for company repositories.

---

# 36. Performance Requirements

For a medium-sized React repository:

```text
~1,000 source files
```

target:

> Complete deterministic analysis within a reasonable development-tool runtime, with incremental analysis prioritized for subsequent runs.

Use:

* file caching
* AST caching
* changed-file detection
* parallel rule execution
* ignore patterns

---

# 37. Package Architecture

Recommended:

```text
repolens/
│
├── packages/
│   ├── core/
│   ├── cli/
│   ├── rules-react/
│   ├── rules-typescript/
│   ├── rules-architecture/
│   ├── standards/
│   ├── analyzer/
│   └── reporters/
│
├── examples/
│
├── tests/
│
└── docs/
```

You can initially keep it as a **single npm package** and split it into packages later.

I actually recommend that for V1.

---

# 38. Recommended V1 Stack

| Area       | Technology                        |
| ---------- | --------------------------------- |
| Language   | TypeScript                        |
| Runtime    | Node.js                           |
| CLI        | Commander                         |
| AST        | ts-morph                          |
| Validation | Zod                               |
| YAML       | yaml                              |
| Markdown   | unified/remark or markdown parser |
| Git        | simple-git                        |
| Testing    | Vitest                            |
| Build      | tsup                              |
| Package    | npm                               |
| Reports    | HTML + JSON                       |
| AI         | Provider abstraction              |
| CI         | GitHub Actions                    |

---

# 39. Testing Requirements

Every rule must have:

### Positive case

Code that should trigger it.

### Negative case

Code that should not trigger it.

### Edge case

Unusual but valid code.

Example:

```text
rules/react/no-missing-key/
    valid.tsx
    invalid.tsx
    edge.tsx
```

The project should target strong automated test coverage.

---

# 40. Example End-to-End Scenario

Repository:

```text
my-company-app/
│
├── src/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   └── pages/
│
└── BEST_PRACTICES.md
```

Standards:

```text
1. API calls belong in services.
2. Components should remain below 250 lines.
3. No any.
4. React Query must be used for server state.
```

Developer runs:

```bash
npx repolens
```

RepoLens discovers:

```text
React
TypeScript
React Query
```

Then:

```text
BEST_PRACTICES.md ✓
```

Analysis finds:

```text
UserDashboard.tsx
- 430 lines
- 3 fetch calls
- 2 any types
- server state managed with useState
```

Output:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RepoLens Engineering Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Score: 71/100

HIGH

[A001]
API call outside services

UserDashboard.tsx:84

Company standard:
API calls belong in services.

Recommendation:
Move request to:
src/services/userService.ts


HIGH

[T001]
Explicit any

UserDashboard.tsx:121


MEDIUM

[R004]
Component exceeds configured size

430 / 250 lines


HIGH

[STATE001]
Server state is not using React Query

UserDashboard.tsx:145
```

That's exactly the experience your package should deliver.

---

# 41. V1 Definition of Done

I would consider V1 complete when all of these work:

### Repository

* [ ] CLI accepts repository path
* [ ] React detection
* [ ] TypeScript detection
* [ ] package.json parsing
* [ ] source discovery
* [ ] ignore patterns

### Standards

* [ ] BEST_PRACTICES.md discovery
* [ ] `.repolens.yml`
* [ ] standard hierarchy
* [ ] rule configuration

### Analysis

* [ ] AST parsing
* [ ] dependency graph
* [ ] React rules
* [ ] TypeScript rules
* [ ] architecture rules
* [ ] accessibility rules

### Reporting

* [ ] terminal report
* [ ] JSON report
* [ ] HTML report
* [ ] score
* [ ] severity
* [ ] file/line information

### Package

* [ ] npm package
* [ ] README
* [ ] documentation
* [ ] examples
* [ ] automated tests
* [ ] GitHub repository
* [ ] CI

---

# 42. V2

After V1 works:

```text
AI policy extraction
AI architecture review
AI explanations
GitHub Action
PR comments
Baseline
Changed-file analysis
Monorepo support
Plugin system
Auto-fix
```

---

# 43. V3 — The Bigger Product

Eventually RepoLens could become:

```text
                 RepoLens
                    │
       ┌────────────┼─────────────┐
       ↓            ↓             ↓
   Standards     Repository      CI/CD
    Manager       Analyzer       Guard
       │            │             │
       └────────────┼─────────────┘
                    ↓
              Engineering
               Governance
```

A company could have:

```text
Company Engineering Standards
             ↓
         RepoLens
             ↓
       ┌─────┼─────┐
       ↓     ↓     ↓
     Repo A Repo B Repo C
       ↓     ↓     ↓
      92    84    76
```

That starts becoming a **real developer-productivity platform**, rather than simply an npm package.

---

# 44. How I'd use Codex to build it

Don't give Codex the entire project and say:

> "Build RepoLens."

That will produce a messy implementation.

Instead, use the SRS as the **source of truth** and implement sequentially.

### Prompt 1 — Architecture

> Read `SRS.md`. Do not implement features yet. Design the repository architecture, module boundaries, interfaces, data models, and testing strategy for RepoLens V1. Identify ambiguities and propose solutions. Do not write implementation code until approved.

Then have Codex create:

```text
ARCHITECTURE.md
```

### Prompt 2 — Foundation

> Implement the CLI, configuration loading, repository discovery, ignore system, project detection, and shared types according to SRS.md. Write tests for every module.

### Prompt 3 — AST

> Implement the AST analysis layer using ts-morph. Do not implement rules yet. Create reusable APIs for discovering components, imports, hooks, calls, JSX, and source locations. Add tests.

### Prompt 4 — Rule engine

> Implement the rule interface, rule registry, rule execution engine, severity system, and finding model.

### Prompt 5 — Rules

Implement **5–10 rules at a time**, with tests.

### Prompt 6 — Standards

Then:

> Implement BEST_PRACTICES.md discovery, `.repolens.yml`, standard precedence, and company rule configuration.

### Prompt 7 — Reports

Then CLI → JSON → HTML.

### Prompt 8 — AI

**Only after deterministic analysis is stable.**

---

## One architectural principle I would make non-negotiable

Keep this separation:

```text
             Repository
                 ↓
              Analyzer
                 ↓
              Findings
                 ↑
          ┌──────┴──────┐
          │             │
     Deterministic      AI
        Rules          Analysis
```

**AI should never be the foundation of RepoLens.**

That's what will make this a technically credible project for your CV: you're demonstrating **AST analysis, static analysis, configuration-driven architecture, rule engines, dependency graphs, CLI development, npm publishing, CI/CD, and optional LLM integration**—all in one coherent engineering product.
