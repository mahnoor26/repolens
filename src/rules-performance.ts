import ts from 'typescript';
import { isComponent, isFunction } from './analyzer.js';
import { attr, define, finding, isOpening } from './rule-helpers.js';
import type { Rule, RuleFinding } from './types.js';

export const performanceRules: Rule[] = [
  define('large-imports', 'Bundle-heavy import review', 'performance', 'low', 'Review known broad package imports; actual bundle impact depends on the bundler.', ctx => ctx.files.flatMap(file => file.nodes.filter(ts.isImportDeclaration).filter(n => ts.isStringLiteral(n.moduleSpecifier) && ['lodash', 'moment'].includes(n.moduleSpecifier.text) && !n.importClause?.isTypeOnly).map(n => finding(file, n, `Review bundle impact of ${n.moduleSpecifier.getText()}.`, 'Inspect the production bundle; consider a focused entry point or smaller alternative if this import is costly.', 'A broad import can increase shipped JavaScript; tree shaking and build configuration affect the result.', 0.65)))),
  define('render-computation', 'Render computation review', 'performance', 'low', 'Review sorting and JSON parsing directly in component render.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes) {
      if (!ts.isCallExpression(n) || !(n.expression.getText() === 'JSON.parse' || ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'sort')) continue;
      let parent: ts.Node | undefined = n.parent; while (parent && !isFunction(parent)) parent = parent.parent;
      if (parent && isComponent(parent)) out.push(finding(file, n, 'Potentially expensive computation runs during render.', 'Measure cost before memoizing, and avoid mutating props or state with sort().', 'Repeated parsing or sorting can become costly for large collections; small inputs may be fine.', 0.6));
    }
    return out;
  }),
  define('next-image', 'Next.js image optimization', 'performance', 'low', 'Consider the Next.js image component for native images.', ctx => ctx.project.metaFramework !== 'Next.js' ? [] : ctx.files.flatMap(file => file.nodes.filter(isOpening).filter(n => n.tagName.getText() === 'img' && !!attr(n, 'src')).map(n => finding(file, n, 'Native image in a Next.js project.', 'Consider next/image when its optimization and layout behavior suit this image.', 'Image optimization can reduce bandwidth and layout shifts; exceptions may be appropriate.', 0.7)))),
];
