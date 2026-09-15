import type ts from 'typescript';

export const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = typeof severities[number];
export type Category = 'react' | 'typescript' | 'architecture' | 'accessibility' | 'performance';
export type Source = 'company' | 'project' | 'framework' | 'repolens' | 'ai';
export interface RuleOptions { enabled?: boolean; severity?: Severity; limit?: number }
export interface PolicyLayer {
  rules?: Record<string, RuleOptions>;
  architecture?: {
    apiDirectories?: string[];
    componentDirectories?: string[];
    hookDirectories?: string[];
    folders?: Record<string, string>;
    forbiddenImports?: { from: string; to: string }[];
  };
}
export interface Config extends PolicyLayer {
  project?: { framework?: 'react'; language?: 'typescript' };
  standards?: { paths?: string[]; company?: string[] };
  ignore?: string[];
  ignoreRules?: string[];
  score?: { weights?: Partial<Record<Severity, number>> };
  failOn?: Severity | 'none';
}
export interface ResolvedRule extends RuleOptions { source: Source; evidence?: string }
export interface StandardsDocument { file: string; source: 'company' | 'project'; recognized: string[]; unrecognized: string[] }
export interface Standards {
  documents: StandardsDocument[];
  rules: Record<string, ResolvedRule>;
  architecture: Required<NonNullable<PolicyLayer['architecture']>>;
  architectureSource: Source;
  warnings: string[];
}
export interface ProjectProfile {
  root: string; name: string;
  framework?: string; metaFramework?: string; language: string;
  dependencies: Record<string, string>; state: string[]; styling: string[]; tooling: string[];
}
export interface Finding {
  id: string; ruleId: string; ruleName: string; severity: Severity; category: Category;
  file: string; line?: number; column?: number; message: string;
  explanation: string; recommendation: string; source: Source; confidence: number; evidence?: string;
}
export interface DependencyEdge { from: string; to: string; line: number; column: number; typeOnly: boolean }
export interface DependencyGraph { nodes: string[]; edges: DependencyEdge[] }
export interface AnalyzedFile { path: string; ast: ts.SourceFile; nodes: ts.Node[] }
export interface AnalysisContext {
  project: ProjectProfile; files: AnalyzedFile[]; graph: DependencyGraph;
  standards: Standards; config: Config; options: ResolvedRule;
}
export type RuleFinding = Omit<Finding, 'id' | 'ruleId' | 'ruleName' | 'severity' | 'category' | 'source'>;
export interface Rule {
  id: string; name: string; description: string; category: Category; severity: Severity;
  defaultEnabled?: boolean;
  appliesTo(project: ProjectProfile): boolean;
  check(context: AnalysisContext): RuleFinding[];
}
export interface Report {
  version: string; generatedAt: string; project: ProjectProfile; score: number;
  findings: Finding[]; graph: DependencyGraph; standards: Standards;
  statistics: { filesScanned: number; entriesSkipped: number; durationMs: number; bySeverity: Record<Severity, number>; rulesExecuted: number };
  warnings: string[];
}
