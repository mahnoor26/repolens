import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import type { Config, ProjectProfile } from './types.js';

export const slash = (value: string): string => value.replace(/\\/g, '/');
export function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
export function safePath(root: string, relative: string): string {
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw new Error(`Path must stay inside repository: ${relative}`);
  const parts = path.relative(root, target).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlinks are not read: ${relative}`);
  }
  if (parts.some(part => /^\.env(?:\.|$)/i.test(part))) throw new Error('Environment files are not read.');
  return target;
}
export function readText(root: string, relative: string, maxBytes = 2_000_000): string {
  const target = safePath(root, relative);
  const stat = fs.statSync(target);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error(`Not a regular file or exceeds ${maxBytes} bytes: ${relative}`);
  return fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, '');
}
export function optionalText(root: string, relative: string): string | undefined {
  const target = safePath(root, relative);
  return fs.existsSync(target) ? readText(root, relative) : undefined;
}
const excluded = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo', '.cache']);
export interface Discovery { sources: string[]; markdown: string[]; entriesSkipped: number }
export function discover(root: string, config: Config): Discovery {
  const patterns = ignore().add(optionalText(root, '.gitignore') ?? '').add(config.ignore ?? []);
  const result: Discovery = { sources: [], markdown: [], entriesSkipped: 0 };
  const pending = [''];
  while (pending.length) {
    const directory = pending.pop()!;
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = slash(path.join(directory, entry.name));
      if (entry.isSymbolicLink() || excluded.has(entry.name) || /^\.env(?:\.|$)/i.test(entry.name) || patterns.ignores(relative + (entry.isDirectory() ? '/' : ''))) {
        result.entriesSkipped++; continue;
      }
      if (entry.isDirectory()) pending.push(relative);
      else if (/\.(?:tsx?|jsx?|mts|cts|mjs|cjs)$/.test(entry.name) && !/\.d\.[cm]?ts$/.test(entry.name)) result.sources.push(relative);
      else if (/\.md$/i.test(entry.name)) result.markdown.push(relative);
      else result.entriesSkipped++;
    }
  }
  result.sources.sort(); result.markdown.sort();
  return result;
}
export function detectProject(root: string, sources: string[], config: Config): ProjectProfile {
  const raw = optionalText(root, 'package.json');
  let pkg: Record<string, unknown> = {};
  if (raw) {
    try { pkg = JSON.parse(raw); } catch { throw new Error('Invalid package.json: expected valid JSON.'); }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('Invalid package.json: expected an object.');
  }
  const deps: Record<string, string> = {};
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const values = pkg[section];
    if (values && typeof values === 'object' && !Array.isArray(values)) for (const [name, version] of Object.entries(values)) if (typeof version === 'string') deps[name] = version;
  }
  const present = (map: Record<string, string>) => Object.entries(map).filter(([key]) => key in deps).map(([, name]) => name);
  const rootFiles = fs.readdirSync(root);
  return {
    root, name: typeof pkg.name === 'string' ? pkg.name : path.basename(root),
    framework: deps.react ? `React ${deps.react}` : config.project?.framework === 'react' ? 'React (configured)' : sources.some(f => /\.[jt]sx$/.test(f)) ? 'React (inferred from JSX)' : undefined,
    metaFramework: deps.next ? 'Next.js' : deps['@remix-run/react'] ? 'Remix' : undefined,
    language: config.project?.language === 'typescript' || sources.some(f => /\.(?:tsx?|mts|cts)$/.test(f)) || rootFiles.includes('tsconfig.json') ? 'TypeScript' : 'JavaScript',
    dependencies: deps,
    state: present({ '@reduxjs/toolkit': 'Redux Toolkit', '@tanstack/react-query': 'React Query', 'react-query': 'React Query', zustand: 'Zustand', jotai: 'Jotai' }),
    styling: present({ tailwindcss: 'Tailwind CSS', 'styled-components': 'styled-components', '@emotion/react': 'Emotion', sass: 'Sass' }),
    tooling: [...present({ vite: 'Vite', eslint: 'ESLint', vitest: 'Vitest', jest: 'Jest' }), ...rootFiles.filter(f => /^(?:vite|next|eslint)\.config\./.test(f))],
  };
}
