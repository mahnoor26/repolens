import ts from 'typescript';
import { isApiCall, isComponent } from './analyzer.js';
import { define, finding, inDirectory } from './rule-helpers.js';
import type { DependencyGraph, Rule, RuleFinding } from './types.js';

/** Iterative DFS reports back-edge cycle witnesses without recursively overflowing on large repositories. */
export function cycles(graph: DependencyGraph): string[][] {
  const adjacency = new Map(graph.nodes.map(n => [n, [] as string[]]));
  for (const e of graph.edges) if (!e.typeOnly) adjacency.get(e.from)?.push(e.to);
  const state = new Map<string, number>(); const result: string[][] = [];
  for (const start of graph.nodes) {
    if (state.has(start)) continue;
    const stack = [{ node: start, index: 0 }]; const positions = new Map([[start, 0]]); state.set(start, 1);
    while (stack.length) {
      const frame = stack[stack.length - 1]; const neighbors = adjacency.get(frame.node) ?? [];
      if (frame.index === neighbors.length) { state.set(frame.node, 2); positions.delete(frame.node); stack.pop(); continue; }
      const next = neighbors[frame.index++];
      if (state.get(next) === 1) result.push([...stack.slice(positions.get(next)!).map(f => f.node), next]);
      else if (!state.has(next)) { state.set(next, 1); positions.set(next, stack.length); stack.push({ node: next, index: 0 }); }
    }
  }
  return result;
}
export const architectureRules: Rule[] = [
  define('no-api-in-components', 'API location', 'architecture', 'high', 'Network calls belong in configured API directories.', ctx => ctx.files.flatMap(file => inDirectory(file.path, ctx.standards.architecture.apiDirectories) ? [] : file.nodes.filter(isApiCall).map(n => finding(file, n, `API call outside ${ctx.standards.architecture.apiDirectories.join(', ')}.`, `Move request logic to ${ctx.standards.architecture.apiDirectories[0]}/ and expose a typed service function.`, 'Centralized data access keeps transport details out of UI and domain logic.', 0.95)))),
  define('import-direction', 'Forbidden import direction', 'architecture', 'high', 'Enforce configured layer boundaries.', ctx => ctx.graph.edges.filter(e => ctx.standards.architecture.forbiddenImports.some(p => inDirectory(e.from, [p.from]) && inDirectory(e.to, [p.to]))).map(e => ({ file: e.from, line: e.line, column: e.column, message: `Forbidden dependency on ${e.to}.`, explanation: 'Imports against the intended layer direction couple lower-level code to higher-level modules.', recommendation: 'Move the shared contract into a lower-level module or invert this dependency.', confidence: 1 }))),
  define('circular-dependencies', 'Circular module dependency', 'architecture', 'high', 'Find cycles in runtime imports; type-only imports are excluded.', ctx => cycles(ctx.graph).map(cycle => {
    const edge = ctx.graph.edges.find(e => e.from === cycle[0] && e.to === cycle[1])!;
    return { file: cycle[0], line: edge.line, column: edge.column, message: `Circular dependency: ${cycle.join(' -> ')}`, explanation: 'Cycles can expose partially initialized modules and complicate ownership.', recommendation: 'Extract shared dependencies or remove one edge in the reported cycle.', confidence: 1 };
  })),
  define('folder-convention', 'Folder convention', 'architecture', 'medium', 'Check configured folders and component/hook placement.', ctx => {
    const out: RuleFinding[] = [];
    for (const [name, directory] of Object.entries(ctx.standards.architecture.folders)) {
      if (!ctx.files.some(f => inDirectory(f.path, [directory]))) out.push({ file: directory, message: `Configured ${name} folder has no scanned source files.`, explanation: 'The configured architecture expects source code in this folder.', recommendation: 'Create and use the folder, review ignore patterns, or update the convention.', confidence: 0.9 });
    }
    // Placement is enforced only when explicitly enabled/configured, to avoid penalizing feature-based layouts.
    if (ctx.options.source === 'company' || ctx.options.source === 'project') for (const file of ctx.files) {
      const component = file.nodes.find(isComponent);
      const dirs = ctx.standards.architecture.folders.components ? [ctx.standards.architecture.folders.components] : ctx.standards.architecture.componentDirectories;
      if (component && !inDirectory(file.path, dirs) && !/(?:^|\/)(?:pages|app)\//.test(file.path) && !/\.(?:test|spec|stories)\./.test(file.path)) out.push(finding(file, component, 'Component is outside configured component folders.', `Place reusable components in ${dirs.join(', ')} or update the convention.`, 'Consistent placement helps developers locate modules.', 0.85));
      const hook = file.nodes.find(n => ts.isFunctionDeclaration(n) && !!n.name && /^use[A-Z]/.test(n.name.text));
      if (hook && !component && !inDirectory(file.path, ctx.standards.architecture.hookDirectories)) out.push(finding(file, hook, 'Custom hook is outside configured hook folders.', `Place reusable hooks in ${ctx.standards.architecture.hookDirectories.join(', ')}.`, 'Consistent placement makes shared hooks easier to discover.', 0.85));
    }
    return out;
  }),
];
