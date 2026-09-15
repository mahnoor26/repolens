import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ASTAnalyzer, dependencyGraph } from './analyzer.js';
import { loadConfig } from './config.js';
import { detectProject, discover } from './repository.js';
import { resolveStandards } from './standards.js';
import { reactRules } from './rules-react.js';
import { typescriptRules } from './rules-typescript.js';
import { architectureRules } from './rules-architecture.js';
import { accessibilityRules } from './rules-accessibility.js';
import { performanceRules } from './rules-performance.js';
import { severities, type Config, type Report, type Rule, type Severity } from './types.js';

export const builtInRules: Rule[] = [...reactRules, ...typescriptRules, ...architectureRules, ...accessibilityRules, ...performanceRules];
export class RuleRegistry {
  private rules = new Map<string, Rule>();
  constructor(rules: Rule[] = builtInRules) { for (const rule of rules) this.register(rule); }
  register(rule: Rule): this {
    if (this.rules.has(rule.id)) throw new Error(`Duplicate rule ID: ${rule.id}`);
    this.rules.set(rule.id, rule); return this;
  }
  all(): Rule[] { return [...this.rules.values()]; }
}
export interface AuditOptions { config?: string; registry?: RuleRegistry; analyzer?: ASTAnalyzer }
export function audit(repository = '.', options: AuditOptions = {}): Report {
  const started = performance.now();
  const root = fs.realpathSync(path.resolve(repository));
  if (!fs.statSync(root).isDirectory()) throw new Error(`Repository is not a directory: ${repository}`);
  const config = loadConfig(root, options.config);
  const discovery = discover(root, config);
  if (!discovery.sources.length) throw new Error('No supported source files found after ignore patterns. Scan a React/TypeScript repository.');
  const project = detectProject(root, discovery.sources, config);
  const standards = resolveStandards(root, discovery.markdown, config);
  const registry = options.registry ?? new RuleRegistry();
  const rules = registry.all();
  for (const id of [...Object.keys(standards.rules), ...(config.ignoreRules ?? [])]) if (!rules.some(r => r.id === id)) throw new Error(`Unknown rule: ${id}. Run repolens --list-rules for valid IDs.`);
  const warnings = [...standards.warnings];
  const files = (options.analyzer ?? new ASTAnalyzer()).analyze(root, discovery.sources);
  const graph = dependencyGraph(root, files, warnings);
  const report: Report = {
    version: '0.1.3', generatedAt: new Date().toISOString(), project, score: 100, findings: [], graph, standards,
    statistics: { filesScanned: files.length, entriesSkipped: discovery.entriesSkipped, durationMs: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, rulesExecuted: 0 }, warnings,
  };
  for (const rule of rules) {
    const override = standards.rules[rule.id];
    const policy = { enabled: rule.defaultEnabled ?? true, severity: rule.severity, ...override, source: override?.source ?? (rule.category === 'react' || rule.category === 'accessibility' ? 'framework' as const : 'repolens' as const) };
    if (!policy.enabled || !rule.appliesTo(project)) continue;
    report.statistics.rulesExecuted++;
    for (const value of rule.check({ project, files, graph, standards, config, options: policy })) {
      const id = createHash('sha256').update(`${rule.id}\0${value.file}\0${value.line ?? 0}\0${value.column ?? 0}\0${value.message}`).digest('hex').slice(0, 16);
      report.findings.push({ ...value, id, ruleId: rule.id, ruleName: rule.name, category: rule.category, severity: policy.severity, source: policy.source, evidence: policy.evidence });
    }
  }
  report.findings.sort((a, b) => severities.indexOf(a.severity) - severities.indexOf(b.severity) || a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.ruleId.localeCompare(b.ruleId));
  for (const f of report.findings) report.statistics.bySeverity[f.severity]++;
  report.score = calculateScore(report.statistics.bySeverity, config);
  report.statistics.durationMs = Math.round(performance.now() - started);
  return report;
}
export function calculateScore(counts: Record<Severity, number>, config: Config = {}): number {
  const weights = { critical: 15, high: 8, medium: 3, low: 1, info: 0, ...config.score?.weights };
  return Math.max(0, Math.round(100 - severities.reduce((sum, s) => sum + counts[s] * weights[s], 0)));
}
export function shouldFail(report: Report, threshold: Severity | 'none'): boolean {
  return threshold !== 'none' && report.findings.some(f => severities.indexOf(f.severity) <= severities.indexOf(threshold));
}
