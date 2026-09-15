import { parseYaml, policySchema } from './config.js';
import { readText } from './repository.js';
import type { Config, PolicyLayer, RuleOptions, Standards, StandardsDocument } from './types.js';

const conventional = /(?:^|\/)(?:best.practices|coding.standards|engineering.guidelines|architecture|contributing|development.guidelines)\.md$/i;
export function resolveStandards(root: string, markdown: string[], config: Config): Standards {
  const result: Standards = {
    documents: [], rules: {}, warnings: [], architectureSource: 'repolens',
    architecture: { apiDirectories: ['src/services'], componentDirectories: ['src/components'], hookDirectories: ['src/hooks'], folders: {}, forbiddenImports: [{ from: 'src/services', to: 'src/components' }] },
  };
  function apply(layer: PolicyLayer, source: 'project' | 'company', evidence: string) {
    for (const [id, options] of Object.entries(layer.rules ?? {})) result.rules[id] = { ...result.rules[id], ...options, source, evidence };
    if (layer.architecture) {
      result.architecture = { ...result.architecture, ...layer.architecture, folders: { ...result.architecture.folders, ...layer.architecture.folders } };
      result.architectureSource = source;
      const affected = [
        ...(layer.architecture.apiDirectories ? ['no-api-in-components'] : []),
        ...(layer.architecture.forbiddenImports ? ['import-direction'] : []),
        ...(layer.architecture.folders || layer.architecture.componentDirectories || layer.architecture.hookDirectories ? ['folder-convention'] : []),
      ];
      for (const id of affected) result.rules[id] = { ...result.rules[id], source, evidence };
    }
  }
  function parseMarkdown(file: string, content: string, source: 'project' | 'company') {
    const doc: StandardsDocument = { file, source, recognized: [], unrecognized: [] };
    // Only explicit repolens fences are executable policy. Other code examples are ignored.
    const fences = /```repolens\s*\r?\n([\s\S]*?)```/g;
    const blocks = [...content.matchAll(fences)];
    const prose = content.replace(/```[^\n]*\n[\s\S]*?```/g, '').replace(/~~~[^\n]*\n[\s\S]*?~~~/g, '');
    for (const raw of prose.split(/\r?\n/)) {
      const line = raw.replace(/^\s*(?:[-*]|\d+\.)?\s*/, '').trim();
      if (!line || line.startsWith('#')) continue;
      let id: string | undefined; let options: RuleOptions = { enabled: true }; let layer: PolicyLayer = {};
      if (/^(?:no (?:explicit )?any\.?|(?:do not|don't|never) use (?:explicit )?`?any`?\.?)$/i.test(line)) id = 'no-any';
      const size = line.match(/^components? (?:should|must) (?:remain |stay |be )?(?:below|under|at most|not exceed) (\d+) lines?\.?$/i);
      if (size) { id = 'component-max-lines'; options.limit = Number(size[1]); }
      const api = line.match(/^api calls (?:must be (?:placed |located )?(?:inside|in)|belong in|must live in) `?([\w./-]+)`?\.?$/i);
      if (api) { id = 'no-api-in-components'; const directory = api[1].replace(/\.$/, '').replace(/\/$/, ''); layer.architecture = { apiDirectories: [directory === 'services' ? 'src/services' : directory] }; }
      if (/^react query must be used for server state\.?$/i.test(line)) id = 'server-state-query';
      if (id) {
        layer.rules = { [id]: options };
        apply(policySchema.parse(layer), source, `${file}: ${line}`); doc.recognized.push(line);
      } else if (/\b(must|should|never|convention|guideline|standard|require|don't|do not)\b/i.test(line)) doc.unrecognized.push(line);
    }
    for (const block of blocks) {
      const parsed = policySchema.safeParse(parseYaml(block[1], file));
      if (!parsed.success) throw new Error(`Invalid repolens policy block in ${file}: ${parsed.error.message}`);
      apply(parsed.data, source, `${file}: repolens policy block`); doc.recognized.push('Explicit repolens policy block');
    }
    result.documents.push(doc);
  }
  const company = new Set(config.standards?.company ?? []);
  const explicit = new Set(config.standards?.paths ?? []);
  for (const file of [...new Set([...markdown, ...explicit])].sort()) {
    if (company.has(file)) continue;
    const text = readText(root, file);
    if (explicit.has(file) || conventional.test(file) || /(?:coding standards|engineering standards|best practices|architecture|conventions|guidelines)/i.test(text)) parseMarkdown(file, text, 'project');
  }
  // Explicit project configuration overrides project prose; company policy has final precedence.
  apply(config, 'project', '.repolens configuration');
  for (const file of company) {
    const text = readText(root, file);
    if (/\.ya?ml$/i.test(file)) {
      apply(policySchema.parse(parseYaml(text, file)), 'company', file);
      result.documents.push({ file, source: 'company', recognized: ['Explicit YAML policy'], unrecognized: [] });
    } else parseMarkdown(file, text, 'company');
  }
  for (const id of config.ignoreRules ?? []) {
    if (result.rules[id]?.source === 'company') result.warnings.push(`ignoreRules cannot override company policy for ${id}.`);
    else result.rules[id] = { ...result.rules[id], enabled: false, source: 'project' };
  }
  if (!result.documents.length && !Object.keys(config.rules ?? {}).length && !config.architecture) result.warnings.push('No organization-specific standards found. Using framework and RepoLens defaults.');
  const unsupported = result.documents.reduce((n, d) => n + d.unrecognized.length, 0);
  if (unsupported) result.warnings.push(`${unsupported} policy statement(s) need manual configuration; they were not activated.`);
  return result;
}
