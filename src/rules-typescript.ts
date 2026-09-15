import ts from 'typescript';
import { isFunction } from './analyzer.js';
import { define, finding } from './rule-helpers.js';
import type { Rule, RuleFinding } from './types.js';

export const typescriptRules: Rule[] = [
  define('no-any', 'Explicit any', 'typescript', 'high', 'Avoid explicit any annotations.', ctx => ctx.files.flatMap(file => file.nodes.filter(n => n.kind === ts.SyntaxKind.AnyKeyword).map(n => finding(file, n, 'Explicit any bypasses type checking.', 'Use a specific type, a generic, or unknown with runtime narrowing.', 'any lets unchecked values propagate across otherwise typed boundaries.')))),
  define('excessive-assertions', 'Excessive type assertions', 'typescript', 'medium', 'Report files with more than five type assertions by default.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) {
      const assertions = file.nodes.filter(n => (ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) && n.type.getText() !== 'const');
      if (assertions.length > (ctx.options.limit ?? 5)) out.push(finding(file, assertions[0], `File contains ${assertions.length} type assertions (limit ${ctx.options.limit ?? 5}).`, 'Improve boundary types and use type guards or satisfies where appropriate.', 'Type assertions provide no runtime validation and can conceal incorrect assumptions.', 0.85));
    }
    return out;
  }),
  define('explicit-return-types', 'Missing public return type', 'typescript', 'medium', 'Exported functions should declare return types when enabled.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes) {
      if (!isFunction(n) || n.type || !n.body) continue;
      let exported = ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (ts.isVariableDeclaration(n.parent) && ts.isVariableDeclarationList(n.parent.parent) && ts.isVariableStatement(n.parent.parent.parent)) exported = n.parent.parent.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (exported) out.push(finding(file, n, 'Exported function has no explicit return type.', 'Declare the function return type to make the public contract explicit.', 'Explicit public return types reveal accidental API changes during review.'));
    }
    return out;
  }, false),
  define('duplicate-types', 'Potential duplicate type shapes', 'typescript', 'low', 'Find identical simple object type declarations across files.', ctx => {
    const seen = new Map<string, { name: string; file: string }>(); const out: RuleFinding[] = [];
    for (const file of ctx.files) for (const n of file.nodes) {
      if (!ts.isInterfaceDeclaration(n) && !ts.isTypeAliasDeclaration(n)) continue;
      if (n.typeParameters?.length || (ts.isInterfaceDeclaration(n) && n.heritageClauses?.length)) continue;
      const members = ts.isInterfaceDeclaration(n) ? n.members : ts.isTypeLiteralNode(n.type) ? n.type.members : undefined;
      if (!members || members.length < 2 || !members.every(m => ts.isPropertySignature(m) && m.type && [ts.SyntaxKind.StringKeyword, ts.SyntaxKind.NumberKeyword, ts.SyntaxKind.BooleanKeyword].includes(m.type.kind))) continue;
      const shape = members.map(m => m.getText().replace(/\s+/g, '').replace(/[;,]$/, '')).sort().join(';');
      const previous = seen.get(shape);
      if (previous && previous.file !== file.path) out.push(finding(file, n, `${n.name.text} has the same primitive property shape as ${previous.name} in ${previous.file}.`, 'Share a type if these declarations model the same concept; otherwise keep them separate.', 'Structurally identical types can drift, but may intentionally represent different domain concepts.', 0.65));
      else seen.set(shape, { name: n.name.text, file: file.path });
    }
    return out;
  }),
  define('unsafe-typescript', 'Unsafe TypeScript escape hatch', 'typescript', 'medium', 'Find non-null assertions and ts-ignore/ts-nocheck directives.', ctx => {
    const out: RuleFinding[] = [];
    for (const file of ctx.files) {
      for (const n of file.nodes.filter(ts.isNonNullExpression)) out.push(finding(file, n, 'Non-null assertion bypasses null checking.', 'Check the value explicitly or model the invariant in its type.', 'The assertion is erased at runtime and cannot prevent a null access.'));
      const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, file.ast.text);
      for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) if ([ts.SyntaxKind.SingleLineCommentTrivia, ts.SyntaxKind.MultiLineCommentTrivia].includes(token) && /@ts-(?:ignore|nocheck)\b/.test(scanner.getTokenText())) {
        const loc = file.ast.getLineAndCharacterOfPosition(scanner.getTokenPos());
        out.push({ file: file.path, line: loc.line + 1, column: loc.character + 1, message: 'Type checking is suppressed with a directive.', explanation: 'Suppression can hide new errors as code changes.', recommendation: 'Fix the type error or use a documented @ts-expect-error for an intentional exception.', confidence: 1 });
      }
    }
    return out;
  }),
];
