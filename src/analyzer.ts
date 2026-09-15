import path from "node:path";
import fs from "node:fs";
import ts from "typescript";
import {
  inside,
  optionalText,
  readText,
  safePath,
  slash,
} from "./repository.js";
import type { AnalyzedFile, DependencyGraph } from "./types.js";

export function descendants(node: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = [];
  // A repository can contain a very deeply nested expression or JSX tree.
  // Keep the traversal on the heap rather than consuming the JavaScript call stack.
  const pending: ts.Node[] = [];
  ts.forEachChild(node, (child) => {
    pending.push(child);
  });
  while (pending.length) {
    const child = pending.pop()!;
    nodes.push(child);
    const children: ts.Node[] = [];
    ts.forEachChild(child, (grandchild) => {
      children.push(grandchild);
    });
    // Reverse push preserves the previous pre-order, left-to-right traversal.
    for (let index = children.length - 1; index >= 0; index--)
      pending.push(children[index]);
  }
  return nodes;
}
export function location(node: ts.Node): { line: number; column: number } {
  const p = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  return { line: p.line + 1, column: p.character + 1 };
}
export function unwrap(node: ts.Node): ts.Node {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  )
    node = node.expression;
  return node;
}
export function isFunction(
  node: ts.Node,
): node is
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}
export function functionName(node: ts.Node): string {
  if (isFunction(node) && node.name) return node.name.getText();
  if (
    ts.isFunctionDeclaration(node) &&
    node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
  )
    return "DefaultExport";
  if (ts.isExportAssignment(node.parent)) return "DefaultExport";
  if (
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  )
    return node.parent.name.text;
  if (
    ts.isCallExpression(node.parent) &&
    ts.isVariableDeclaration(node.parent.parent)
  )
    return node.parent.parent.name.getText();
  return "";
}
export function isComponent(node: ts.Node): boolean {
  if (ts.isClassDeclaration(node))
    return (
      node.heritageClauses?.some((h) =>
        h.types.some((t) =>
          /(?:^|\.)(?:Pure)?Component$/.test(t.expression.getText()),
        ),
      ) ?? false
    );
  return (
    isFunction(node) &&
    /^[A-Z]/.test(functionName(node)) &&
    descendants(node).some(
      (n) =>
        ts.isJsxElement(n) ||
        ts.isJsxSelfClosingElement(n) ||
        ts.isJsxFragment(n),
    )
  );
}
export function callName(node: ts.CallExpression): string {
  return node.expression.getText();
}
export function isHookCall(
  node: ts.Node,
  name: string,
): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  const sf = node.getSourceFile();
  const imports = sf.statements
    .filter(ts.isImportDeclaration)
    .filter(
      (i) =>
        ts.isStringLiteral(i.moduleSpecifier) &&
        i.moduleSpecifier.text === "react",
    );
  for (const imp of imports) {
    const clause = imp.importClause;
    if (
      ts.isIdentifier(node.expression) &&
      clause?.namedBindings &&
      ts.isNamedImports(clause.namedBindings) &&
      clause.namedBindings.elements.some(
        (e) =>
          e.name.text === node.expression.getText() &&
          (e.propertyName?.text ?? e.name.text) === name,
      )
    )
      return true;
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === name
    ) {
      const ns =
        clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)
          ? clause.namedBindings.name.text
          : clause?.name?.text;
      if (ns === node.expression.expression.getText()) return true;
    }
  }
  return false;
}
export function isApiCall(
  node: ts.Node,
): node is ts.CallExpression | ts.NewExpression {
  if (ts.isNewExpression(node))
    return node.expression.getText() === "XMLHttpRequest";
  if (!ts.isCallExpression(node)) return false;
  if (/^(?:(?:window|globalThis)\.)?fetch$/.test(callName(node))) return true;
  for (const imp of node
    .getSourceFile()
    .statements.filter(ts.isImportDeclaration)) {
    if (
      !ts.isStringLiteral(imp.moduleSpecifier) ||
      imp.moduleSpecifier.text !== "axios"
    )
      continue;
    const clause = imp.importClause;
    const aliases = [clause?.name?.text];
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings))
      aliases.push(clause.namedBindings.name.text);
    const expr = node.expression;
    if (ts.isIdentifier(expr) && aliases.includes(expr.text)) return true;
    if (
      ts.isPropertyAccessExpression(expr) &&
      aliases.includes(expr.expression.getText()) &&
      /^(get|post|put|patch|delete|request|head|options)$/.test(expr.name.text)
    )
      return true;
  }
  return false;
}
export class ASTAnalyzer {
  private cache = new Map<string, { text: string; file: AnalyzedFile }>();
  parse(file: string, text: string, root = "."): AnalyzedFile {
    const key = path.resolve(root, file);
    const cached = this.cache.get(key);
    if (cached?.text === text) return cached.file;
    const ast = ts.createSourceFile(key, text, ts.ScriptTarget.Latest, true);
    const diagnostics = (
      ast as ts.SourceFile & { parseDiagnostics: ts.Diagnostic[] }
    ).parseDiagnostics;
    if (diagnostics.length)
      throw new Error(
        `Cannot parse ${file}: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, " ")}`,
      );
    const parsed = { path: slash(file), ast, nodes: descendants(ast) };
    this.cache.set(key, { text, file: parsed });
    return parsed;
  }
  analyze(root: string, files: string[]): AnalyzedFile[] {
    return files.map((file) => this.parse(file, readText(root, file), root));
  }
  clear(): void {
    this.cache.clear();
  }
}
export function dependencyGraph(
  root: string,
  files: AnalyzedFile[],
  warnings: string[],
): DependencyGraph {
  // Respect platform casing on Linux/macOS; Windows module paths are case-insensitive.
  const key = (p: string) =>
    process.platform === "win32" ? slash(p).toLowerCase() : slash(p);
  const known = new Map(
    files.map((f) => [key(path.resolve(root, f.path)), f.path]),
  );
  let options: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
  };
  const configText = optionalText(root, "tsconfig.json");
  if (configText) {
    const parsed = ts.parseConfigFileTextToJson("tsconfig.json", configText);
    if (parsed.error)
      throw new Error(
        `Invalid tsconfig.json: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, " ")}`,
      );
    const converted = ts.convertCompilerOptionsFromJson(
      parsed.config.compilerOptions ?? {},
      root,
    );
    if (converted.errors.length)
      warnings.push(
        "Some tsconfig compiler options are unsupported; dependency resolution may be incomplete.",
      );
    options = { ...options, ...converted.options };
    if (parsed.config.extends || parsed.config.references)
      warnings.push(
        "V1 resolves root tsconfig options only; inherited configs and project references are not expanded.",
      );
  }
  const host: ts.ModuleResolutionHost = {
    fileExists: (file) => {
      try {
        if (!inside(root, file)) return false;
        return fs.statSync(safePath(root, path.relative(root, file))).isFile();
      } catch {
        return false;
      }
    },
    readFile: (file) => {
      try {
        return readText(root, path.relative(root, file));
      } catch {
        return undefined;
      }
    },
    directoryExists: (dir) => {
      try {
        return (
          inside(root, dir) &&
          fs.statSync(safePath(root, path.relative(root, dir))).isDirectory()
        );
      } catch {
        return false;
      }
    },
    getCurrentDirectory: () => root,
  };
  const graph: DependencyGraph = { nodes: files.map((f) => f.path), edges: [] };
  const cache = ts.createModuleResolutionCache(root, key, options);
  for (const file of files)
    for (const node of file.nodes) {
      let specifier: ts.StringLiteralLike | undefined;
      let typeOnly = false;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        specifier = node.moduleSpecifier;
        typeOnly = ts.isExportDeclaration(node)
          ? node.isTypeOnly
          : !!node.importClause?.isTypeOnly ||
            !!(
              node.importClause?.namedBindings &&
              ts.isNamedImports(node.importClause.namedBindings) &&
              !node.importClause.name &&
              node.importClause.namedBindings.elements.length &&
              node.importClause.namedBindings.elements.every(
                (e) => e.isTypeOnly,
              )
            );
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          node.expression.getText() === "require") &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      )
        specifier = node.arguments[0];
      if (!specifier) continue;
      const resolved = ts.resolveModuleName(
        specifier.text,
        file.ast.fileName,
        options,
        host,
        cache,
      ).resolvedModule;
      const to = resolved
        ? known.get(key(path.resolve(resolved.resolvedFileName)))
        : undefined;
      if (to)
        graph.edges.push({
          from: file.path,
          to,
          ...location(specifier),
          typeOnly,
        });
      else if (
        specifier.text.startsWith(".") &&
        !/\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|json)$/.test(
          specifier.text,
        )
      )
        warnings.push(
          `Unresolved or excluded local import: ${file.path} -> ${specifier.text}`,
        );
    }
  return graph;
}
