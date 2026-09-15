import { z } from 'zod';
import { parseDocument } from 'yaml';
import { optionalText, readText } from './repository.js';
import { severities, type Config } from './types.js';

const relative = z.string().min(1).refine(v => !v.includes('\\') && !v.startsWith('/') && !/^[a-z]:/i.test(v) && !v.split('/').includes('..') && !v.split('/').some(p => /^\.env(?:\.|$)/i.test(p)), 'Use a repository-relative path with forward slashes; parent paths and .env are forbidden');
const rule = z.object({ enabled: z.boolean().optional(), severity: z.enum(severities).optional(), limit: z.number().int().positive().optional() }).strict();
export const policySchema = z.object({
  rules: z.record(rule).optional(),
  architecture: z.object({
    apiDirectories: z.array(relative).min(1).optional(), componentDirectories: z.array(relative).min(1).optional(),
    hookDirectories: z.array(relative).min(1).optional(), folders: z.record(relative).optional(),
    forbiddenImports: z.array(z.object({ from: relative, to: relative }).strict()).optional(),
  }).strict().optional(),
}).strict();
export const configSchema = policySchema.extend({
  project: z.object({ framework: z.literal('react').optional(), language: z.literal('typescript').optional() }).strict().optional(),
  standards: z.object({ paths: z.array(relative).optional(), company: z.array(relative).optional() }).strict().optional(),
  ignore: z.array(z.string().min(1)).optional(), ignoreRules: z.array(z.string()).optional(),
  score: z.object({ weights: z.object(Object.fromEntries(severities.map(s => [s, z.number().nonnegative().finite().optional()]))).strict().optional() }).strict().optional(),
  failOn: z.enum([...severities, 'none']).optional(),
}).strict();
export function parseYaml(text: string, file: string): unknown {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length || document.warnings.length) throw new Error(`Invalid YAML in ${file}: ${[...document.errors, ...document.warnings].map(e => e.message).join('; ')}`);
  return document.toJS({ maxAliasCount: 25 }) ?? {};
}
export function loadConfig(root: string, filename?: string): Config {
  const file = filename ?? (optionalText(root, '.repolens.yml') !== undefined ? '.repolens.yml' : '.repolens.yaml');
  const text = filename ? readText(root, file) : optionalText(root, file);
  if (text === undefined) return {};
  const result = configSchema.safeParse(parseYaml(text, file));
  if (!result.success) throw new Error(`Invalid configuration ${file}: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return result.data as Config;
}
