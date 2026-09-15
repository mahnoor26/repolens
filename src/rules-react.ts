import ts from 'typescript';
import { descendants, functionName, isApiCall, isComponent, isFunction, isHookCall, unwrap } from './analyzer.js';
import { attr, define, finding, hasSpread, isOpening } from './rule-helpers.js';
import type { AnalyzedFile, Rule, RuleFinding } from './types.js';

function directReturns(fn: ts.Node): ts.Node[] {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [unwrap(fn.body)];
  const values: ts.Node[] = [];
  function visit(n: ts.Node) {
    if (n !== fn && isFunction(n)) return;
    if (ts.isReturnStatement(n) && n.expression) values.push(unwrap(n.expression));
    else ts.forEachChild(n, visit);
  }
  visit(fn); return values;
}
function jsxRoots(n: ts.Node): ts.Node[] {
  n = unwrap(n);
  if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return [n];
  if (ts.isConditionalExpression(n)) return [...jsxRoots(n.whenTrue), ...jsxRoots(n.whenFalse)];
  if (ts.isBinaryExpression(n)) return [...jsxRoots(n.left), ...jsxRoots(n.right)];
  return [];
}
function stateSetters(file: AnalyzedFile): Map<string, ts.Node> {
  const result = new Map<string, ts.Node>();
  for (const n of file.nodes) if (ts.isVariableDeclaration(n) && n.initializer && isHookCall(n.initializer, 'useState') && ts.isArrayBindingPattern(n.name)) {
    const setter = n.name.elements[1]; if (setter && ts.isBindingElement(setter) && ts.isIdentifier(setter.name)) result.set(setter.name.text, n);
  }
  return result;
}
export const reactRules: Rule[] = [
  define('missing-key', 'Missing React key', 'react', 'medium', 'Elements returned from map callbacks need stable keys.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes) {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression) || n.expression.name.text !== 'map') continue;
      const callback = n.arguments[0]; if (!callback || !isFunction(callback)) continue;
      for (const returned of directReturns(callback)) for (const root of jsxRoots(returned)) {
        const opening = ts.isJsxElement(root) ? root.openingElement : root;
        if (isOpening(opening) && (attr(opening, 'key') || hasSpread(opening))) continue;
        out.push(finding(file, root, 'Mapped JSX is missing a key.', 'Add key={item.id} to the outermost element; use a keyed Fragment instead of <>.', 'Stable keys let React preserve the identity of list items.'));
      }
    }
    return out;
  }),
  define('derived-state', 'State initialized from props', 'react', 'low', 'Review state that copies props on initialization.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes) {
      if (!isHookCall(n, 'useState') || !n.arguments[0]) continue;
      let parent: ts.Node | undefined = n.parent;
      while (parent && !isFunction(parent)) parent = parent.parent;
      if (!parent || !isFunction(parent) || !isComponent(parent)) continue;
      const names = parent.parameters.flatMap(p => ts.isIdentifier(p.name) ? [p.name.text] : p.name.elements.flatMap(e => ts.isBindingElement(e) ? [e.name.getText()] : []));
      const initial = unwrap(n.arguments[0]);
      if ((ts.isIdentifier(initial) && names.includes(initial.text)) || (ts.isPropertyAccessExpression(initial) && names.includes(initial.expression.getText()))) out.push(finding(file, n, 'State is initialized directly from a prop.', 'Use the prop directly if it should stay synchronized, or document that it is an initial value.', 'useState only uses the initial value once; later prop changes do not update this state.', 0.7));
    }
    return out;
  }),
  define('derived-effect', 'Effect derives state', 'react', 'low', 'Review effects containing only a synchronous state assignment.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) {
      const setters = stateSetters(file);
      for (const n of file.nodes) {
        if (!isHookCall(n, 'useEffect')) continue;
        const cb = n.arguments[0]; if (!cb || !isFunction(cb) || !cb.body) continue;
        const body = ts.isBlock(cb.body) && cb.body.statements.length === 1 && ts.isExpressionStatement(cb.body.statements[0]) ? cb.body.statements[0].expression : cb.body;
        if (!ts.isCallExpression(body) || !setters.has(body.expression.getText()) || body.arguments.length !== 1) continue;
        if (descendants(body.arguments[0]).some(isApiCall) || isApiCall(body.arguments[0]) || isFunction(body.arguments[0])) continue;
        out.push(finding(file, n, 'Effect only assigns derived state.', 'Consider calculating this value during render, or useMemo if measurement justifies caching.', 'A state update in an effect adds another render and duplicates a source of truth.', 0.75));
      }
    }
    return out;
  }),
  define('component-max-lines', 'Oversized component', 'react', 'medium', 'Components should stay below the configured line limit (default 250).', ctx => {
    const out: RuleFinding[] = []; const limit = ctx.options.limit ?? 250;
    for (const file of ctx.files) for (const n of file.nodes.filter(isComponent)) {
      const count = file.ast.getLineAndCharacterOfPosition(n.end).line - file.ast.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      if (count > limit) out.push(finding(file, n, `${functionName(n) || 'Component'} has ${count} lines (limit ${limit}).`, 'Extract cohesive child components, hooks, or pure helper functions.', 'Large components are harder to review, test, and change safely.'));
    }
    return out;
  }),
  define('component-responsibilities', 'Component responsibility review', 'react', 'low', 'Components with many hooks and network calls may mix responsibilities.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes.filter(isComponent)) {
      const children = descendants(n); const hooks = children.filter(c => ts.isCallExpression(c) && /^(?:\w+\.)?use[A-Z]/.test(c.expression.getText())).length;
      if (hooks > (ctx.options.limit ?? 6) && children.some(isApiCall)) out.push(finding(file, n, `Component mixes ${hooks} hook calls with network access.`, 'Review whether data access and state orchestration belong in a dedicated hook.', 'This heuristic suggests a responsibility review; it does not prove a design defect.', 0.65));
    }
    return out;
  }),
  define('server-state-query', 'Server state policy', 'react', 'high', 'Review manual server-state fetching when React Query is required.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes) {
      if (!isHookCall(n, 'useEffect')) continue;
      const cb = n.arguments[0]; if (!cb) continue;
      const children = descendants(cb); const setters = stateSetters(file);
      if (children.some(isApiCall) && children.some(c => ts.isCallExpression(c) && setters.has(c.expression.getText()))) out.push(finding(file, n, 'Effect fetches data and writes local state under a React Query policy.', 'Move the request into a service and manage server state with useQuery/useMutation.', 'Manual server state often duplicates cache, loading, retry, and synchronization behavior.', 0.8));
    }
    return out;
  }, false),
];
