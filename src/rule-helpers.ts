import ts from 'typescript';
import { descendants, location, unwrap } from './analyzer.js';
import type { AnalyzedFile, Category, Rule, RuleFinding, Severity } from './types.js';

export function finding(file: AnalyzedFile, node: ts.Node, message: string, recommendation: string, explanation: string, confidence = 1): RuleFinding {
  return { file: file.path, ...location(node), message, recommendation, explanation, confidence };
}
export function define(id: string, name: string, category: Category, severity: Severity, description: string, check: Rule['check'], defaultEnabled = true): Rule {
  return { id, name, category, severity, description, check, defaultEnabled,
    appliesTo: project => category === 'react' || category === 'accessibility' ? !!project.framework : category === 'typescript' ? project.language === 'TypeScript' : true };
}
export type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;
export const isOpening = (n: ts.Node): n is Opening => ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n);
export function attr(node: Opening, name: string): ts.JsxAttribute | undefined { return node.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name); }
export function attrText(node: Opening, name: string): string | undefined {
  const a = attr(node, name);
  if (!a) return undefined;
  if (!a.initializer) return 'true';
  if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
  if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
    const value = unwrap(a.initializer.expression);
    if (ts.isStringLiteral(value) || ts.isNumericLiteral(value)) return value.text;
    if (value.kind === ts.SyntaxKind.TrueKeyword) return 'true';
    if (value.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  }
  return undefined;
}
export const hasSpread = (n: Opening): boolean => n.attributes.properties.some(ts.isJsxSpreadAttribute);
export function hasName(node: Opening): boolean {
  // JSX can be nested far beyond the JavaScript call stack. Search descendants
  // iteratively so an accessibility check cannot abort the entire repository audit.
  const pending: Opening[] = [node];
  const visited = new Set<ts.Node>();
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (hasSpread(current)) return true;
    for (const name of ['aria-label', 'aria-labelledby', 'title']) if (attr(current, name) && attrText(current, name) !== '') return true;
    if (!ts.isJsxElement(current.parent)) continue;
    for (const child of current.parent.children) {
      if (ts.isJsxText(child) && child.text.trim()) return true;
      if (ts.isJsxExpression(child) && child.expression && ![ts.SyntaxKind.NullKeyword, ts.SyntaxKind.FalseKeyword].includes(child.expression.kind) && (!ts.isStringLiteral(child.expression) || !!child.expression.text.trim())) return true;
      if (ts.isJsxElement(child)) pending.push(child.openingElement);
      if (ts.isJsxSelfClosingElement(child)) {
        if ((child.tagName.getText() === 'img' && !!attrText(child, 'alt')) || /^[A-Z]/.test(child.tagName.getText())) return true;
        pending.push(child);
      }
    }
  }
  return false;
}
export function inDirectory(file: string, directories: string[]): boolean { return directories.some(d => file === d.replace(/\/$/, '') || file.startsWith(d.replace(/\/$/, '') + '/')); }
export const nested = (node: ts.Node, predicate: (n: ts.Node) => boolean): boolean => descendants(node).some(predicate);
