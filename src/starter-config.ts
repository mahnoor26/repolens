/** A deliberately commented configuration that project owners can edit without learning the rule IDs first. */
export const starterConfig = `# RepoLens project rules
#
# This file controls the checks that run for THIS repository.
# Change a rule, save this file, and run RepoLens again. No package code is needed.
#
# enabled: true  = check this rule
# enabled: false = do not check this rule
# severity: critical | high | medium | low | info
#   critical/high: a problem worth addressing first
#   medium: a quality or accessibility concern
#   low/info: a suggestion for review, not necessarily a defect
#
# You can delete a rule section to return it to RepoLens' default setting.

rules:
  # React: Each item created by .map() needs a stable key, usually item.id.
  missing-key:
    enabled: true
    severity: medium

  # React: Review state that starts by copying a prop. It will not follow later prop changes.
  derived-state:
    enabled: true
    severity: low

  # React: Review effects that only calculate a value and put it into state.
  derived-effect:
    enabled: true
    severity: low

  # React: Keep a component small enough to understand and safely change.
  component-max-lines:
    enabled: true
    limit: 250
    severity: medium

  # React: Review a component that has many hooks and also makes network calls.
  component-responsibilities:
    enabled: true
    limit: 6
    severity: low

  # React: Turn this on only if your team requires React Query for server data.
  server-state-query:
    enabled: false
    severity: high

  # TypeScript: Prevent using 'any', which turns off type checking for a value.
  no-any:
    enabled: true
    severity: high

  # TypeScript: Review files that use many 'as SomeType' assertions.
  excessive-assertions:
    enabled: true
    limit: 5
    severity: medium

  # TypeScript: Require a written return type on exported functions.
  explicit-return-types:
    enabled: false
    severity: medium

  # TypeScript: Review simple type definitions that look duplicated across files.
  duplicate-types:
    enabled: true
    severity: low

  # TypeScript: Review non-null assertions and @ts-ignore / @ts-nocheck comments.
  unsafe-typescript:
    enabled: true
    severity: medium

  # Architecture: Keep fetch/axios/XMLHttpRequest calls in the API folders below.
  no-api-in-components:
    enabled: true
    severity: high

  # Architecture: Prevent lower-level code from importing UI components.
  import-direction:
    enabled: true
    severity: high

  # Architecture: Prevent modules from importing each other in a loop.
  circular-dependencies:
    enabled: true
    severity: high

  # Architecture: Check the configured folders are being used consistently.
  folder-convention:
    enabled: true
    severity: medium

  # Accessibility: Images need alt text. Use alt: "" only when an image is decorative.
  image-alt:
    enabled: true
    severity: medium

  # Accessibility: Use <button> for actions rather than clickable divs or spans.
  semantic-button:
    enabled: true
    severity: medium

  # Accessibility: Inputs need a visible or screen-reader label.
  form-label:
    enabled: true
    severity: medium

  # Accessibility: Do not put a button/link inside another button/link.
  nested-interactive:
    enabled: true
    severity: medium

  # Accessibility: Check common ARIA mistakes, including hidden focusable controls.
  aria-misuse:
    enabled: true
    severity: medium

  # Accessibility: Buttons and links need text or an aria-label describing their purpose.
  accessible-name:
    enabled: true
    severity: medium

  # Performance: Review broad lodash and moment imports for bundle impact.
  large-imports:
    enabled: true
    severity: low

  # Performance: Review JSON.parse and array.sort used directly while a component renders.
  render-computation:
    enabled: true
    severity: low

  # Performance: In Next.js, review native <img> elements for next/image suitability.
  next-image:
    enabled: true
    severity: low

# Tell RepoLens where code belongs in your project. Change these paths to match your layout.
architecture:
  apiDirectories: [src/services]
  componentDirectories: [src/components]
  hookDirectories: [src/hooks]
  forbiddenImports:
    # Services should not depend on user-interface components.
    - from: src/services
      to: src/components

# Ignore generated or legacy source. These use .gitignore-style patterns.
# ignore: [generated/, legacy/]

# Rules to skip temporarily. Prefer setting enabled: false above for long-term choices.
# ignoreRules: [duplicate-types]

# Control CI: use 'none' while adopting RepoLens; later use 'high' or 'medium'.
failOn: none
`;
