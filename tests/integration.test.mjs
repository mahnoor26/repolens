import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { audit, ASTAnalyzer, RuleRegistry, calculateScore, shouldFail, htmlReport, jsonReport, terminalReport, loadConfig, descendants, shouldColor } from '../dist/index.js';
import ts from 'typescript';
import { runCli } from '../dist/cli-main.js';

function cli(args) {
  let stdout='',stderr='';
  const status=runCli(args,{out:text=>{stdout+=text},err:text=>{stderr+=text}});
  return {status,stdout,stderr};
}
function fixture(t, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repolens-test-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  const content = { 'package.json': JSON.stringify({name:'example',dependencies:{react:'^19.0.0',next:'^15.0.0','@tanstack/react-query':'^5.0.0',tailwindcss:'^4.0.0'}}), 'src/components/App.tsx':'export function App(){return <p>Hello</p>}', ...files };
  for (const [file,text] of Object.entries(content)) { const target=path.join(root,file); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,text); }
  return root;
}
test('end to end: profile, AST, score, graph, source and report models', t => {
  const root=fixture(t,{'src/components/App.tsx':'import {load} from "../services/load";\nexport const App=()=> <img src="x"/>;', 'src/services/load.ts':'export function load(): any { return fetch("/x") }'});
  const report=audit(root);
  assert.match(report.project.framework,/React/); assert.equal(report.project.language,'TypeScript'); assert.equal(report.project.metaFramework,'Next.js');
  assert.deepEqual(report.project.state,['React Query']); assert.deepEqual(report.project.styling,['Tailwind CSS']);
  assert.equal(report.graph.edges.length,1); assert.equal(report.statistics.filesScanned,2); assert.ok(report.score<100);
  assert.ok(report.findings.some(f=>f.ruleId==='no-any')); assert.ok(report.findings.some(f=>f.ruleId==='image-alt'));
  assert.ok(report.warnings.some(w=>w.includes('No organization-specific'))); assert.deepEqual(JSON.parse(jsonReport(report)),JSON.parse(JSON.stringify(report)));
});
test('standards hierarchy: company overrides project configuration and prose', t => {
  const root=fixture(t,{'src/a.ts':'const x:any = 1;', 'BEST_PRACTICES.md':'No any.\nComponents should remain below 100 lines.\nReact Query must be used for server state.', '.repolens.yml':'standards:\n  company: [company.yml]\nrules:\n  no-any:\n    enabled: false\n    severity: low\nignoreRules: [no-any]', 'company.yml':'rules:\n  no-any:\n    enabled: true\n    severity: critical'});
  const report=audit(root); const f=report.findings.find(f=>f.ruleId==='no-any');
  assert.equal(f.severity,'critical'); assert.equal(f.source,'company'); assert.equal(report.standards.rules['component-max-lines'].limit,100);
  assert.equal(report.standards.rules['server-state-query'].enabled,true); assert.ok(report.warnings.some(w=>w.includes('cannot override company')));
});
test('explicit config overrides recognized project prose', t => {
  const root=fixture(t,{'src/a.ts':'const x:any = 1;', 'BEST_PRACTICES.md':'No any.', '.repolens.yml':'rules:\n  no-any:\n    enabled: false'});
  assert.ok(!audit(root).findings.some(f=>f.ruleId==='no-any'));
});
test('explicit repolens fences activate policy; ordinary code samples do not', t => {
  const root=fixture(t,{'docs/conventions.md':'# Guidelines\n```text\nNo any.\n```\n```repolens\nrules:\n  explicit-return-types:\n    enabled: true\n```', '.repolens.yml':'standards:\n  paths: [docs/conventions.md]'});
  const report=audit(root); assert.equal(report.standards.rules['no-any'],undefined); assert.equal(report.standards.rules['explicit-return-types'].enabled,true);
});
test('unsupported prose stays inactive and is disclosed', t => {
  const root=fixture(t,{'BEST_PRACTICES.md':'Developers must write unit tests for every change.'});
  const report=audit(root); assert.equal(report.standards.documents[0].unrecognized.length,1); assert.ok(report.warnings.some(w=>w.includes('manual configuration')));
});
test('recognized API policy configures directory and finding evidence', t => {
  const root=fixture(t,{'BEST_PRACTICES.md':'API calls must be placed inside src/data.', 'src/services/x.ts':'fetch("/x");'});
  const f=audit(root).findings.find(f=>f.ruleId==='no-api-in-components'); assert.equal(f.source,'project'); assert.match(f.evidence,/BEST_PRACTICES/); assert.match(f.recommendation,/src\/data/);
});
test('an API-only policy does not impose unrelated component placement', t => {
  const root=fixture(t,{'BEST_PRACTICES.md':'API calls belong in services.', 'src/features/Panel.tsx':'export function Panel(){return <p/>}'});
  const report=audit(root); assert.equal(report.standards.rules['folder-convention'],undefined); assert.ok(!report.findings.some(f=>f.ruleId==='folder-convention'));
});
test('help, version and invalid options return expected CLI codes', () => {
  assert.equal(cli(['--help']).status,0); assert.match(cli(['--version']).stdout,/0\.1\.3/); assert.equal(cli(['--unknown']).status,2); assert.equal(cli(['--fail-on','banana']).status,2);
});
test('ignores built-ins, gitignore, configured globs, and environment files', t => {
  const root=fixture(t,{'node_modules/a.ts':'not valid {', 'dist/a.ts':'not valid {', 'generated/a.ts':'not valid {', 'src/legacy/a.ts':'not valid {','.env.ts':'not valid {', '.gitignore':'generated/', '.repolens.yml':'ignore: [src/legacy/]'});
  const report=audit(root); assert.equal(report.statistics.filesScanned,1); assert.ok(report.statistics.entriesSkipped>=4);
});
test('strict config catches misspellings and invalid values', t => {
  for (const config of ['rulse: {}','rules:\n  no-any:\n    severity: banana','rules:\n  no-any:\n    limit: -1','score:\n  weights:\n    high: -1','architecture:\n  apiDirectories: []','ignore: []\nignore: []']) {
    const root=fixture(t,{'.repolens.yml':config}); assert.throws(()=>audit(root),/Invalid/);
  }
});
test('unknown rules fail clearly', t => { const root=fixture(t,{'.repolens.yml':'rules:\n  typo-rule:\n    enabled: true'}); assert.throws(()=>audit(root),/Unknown rule/); });
test('parent traversal and environment config paths are rejected', t => {
  const root=fixture(t); assert.throws(()=>loadConfig(root,'../other.yml'),/inside repository/); assert.throws(()=>loadConfig(root,'.env'),/Environment files/);
});
test('invalid source cannot produce a misleading successful audit', t => { const root=fixture(t,{'src/broken.ts':'const = {'}); assert.throws(()=>audit(root),/Cannot parse/); });
test('missing or empty repository fails clearly', t => { const root=fixture(t,{'.repolens.yml':'ignore: [src/]'}); assert.throws(()=>audit(root),/No supported source/); });
test('invalid package JSON fails clearly', t => { const root=fixture(t,{'package.json':'{"name":'}); assert.throws(()=>audit(root),/Invalid package.json/); });
test('tsconfig aliases, re-exports, dynamic imports and runtime cycles resolve', t => {
  const root=fixture(t,{'tsconfig.json':'{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}', 'src/a.ts':'export {b} from "@/b";', 'src/b.ts':'import("./a"); export const b=1;'});
  const report=audit(root); assert.equal(report.graph.edges.length,2); assert.ok(report.findings.some(f=>f.ruleId==='circular-dependencies'));
});
test('type-only cycles are excluded', t => {
  const root=fixture(t,{'src/a.ts':'import type {B} from "./b"; export type A = B;', 'src/b.ts':'import type {A} from "./a"; export type B = A;'});
  const report=audit(root); assert.equal(report.graph.edges.length,2); assert.ok(!report.findings.some(f=>f.ruleId==='circular-dependencies'));
});
test('service imports cannot depend on component files', t => {
  const root=fixture(t,{'src/services/load.ts':'import {App} from "../components/App";'}); assert.ok(audit(root).findings.some(f=>f.ruleId==='import-direction'));
});
test('inherited tsconfigs explicitly warn about V1 resolution limits', t => {
  const root=fixture(t,{'tsconfig.json':'{"extends":"./tsconfig.base.json"}', 'tsconfig.base.json':'{}'}); assert.ok(audit(root).warnings.some(w=>w.includes('not expanded')));
});
test('unresolved local dependencies are disclosed', t => { const root=fixture(t,{'src/a.ts':'import x from "./missing";'}); assert.ok(audit(root).warnings.some(w=>w.includes('Unresolved'))); });
test('AST cache reuses unchanged files and invalidates edits', () => {
  const a=new ASTAnalyzer(); const first=a.parse('x.ts','const x=1'); assert.equal(a.parse('x.ts','const x=1'),first); assert.notEqual(a.parse('x.ts','const x=2'),first); a.clear(); assert.notEqual(a.parse('x.ts','const x=1'),first);
});
test('AST traversal handles deeply nested nodes without overflowing the call stack', () => {
  let expression = ts.factory.createIdentifier('leaf');
  for (let index = 0; index < 20_000; index++) expression = ts.factory.createParenthesizedExpression(expression);
  const source = ts.factory.createSourceFile([ts.factory.createExpressionStatement(expression)], ts.factory.createToken(ts.SyntaxKind.EndOfFileToken), ts.NodeFlags.None);
  assert.ok(descendants(source).length > 20_000);
});
test('custom rules use the public registry; duplicates fail', t => {
  const root=fixture(t); const custom={id:'custom',name:'Custom',description:'Test',category:'architecture',severity:'info',appliesTo:()=>true,check:()=>[{file:'src/components/App.tsx',line:1,column:1,message:'Example',explanation:'Test',recommendation:'Review',confidence:1}]};
  const registry=new RuleRegistry([custom]); assert.throws(()=>registry.register(custom),/Duplicate/); assert.equal(audit(root,{registry}).findings[0].ruleId,'custom');
});
test('score weights and clamping are deterministic', () => {
  const counts={critical:1,high:1,medium:1,low:1,info:10}; assert.equal(calculateScore(counts),73); assert.equal(calculateScore(counts,{score:{weights:{critical:200}}}),0); assert.equal(calculateScore(counts,{score:{weights:{critical:0,high:0,medium:0,low:0}}}),100);
});
test('threshold compares severity rank correctly', t => { const report=audit(fixture(t,{'src/a.ts':'const x:any=1;'})); assert.equal(shouldFail(report,'high'),true); assert.equal(shouldFail(report,'critical'),false); assert.equal(shouldFail(report,'none'),false); });
test('finding IDs are stable for identical source', t => { const root=fixture(t,{'src/a.ts':'const x:any=1;'}); assert.deepEqual(audit(root).findings.map(f=>f.id),audit(root).findings.map(f=>f.id)); });
test('HTML escapes repository text and contains a restrictive CSP', t => {
  const report=audit(fixture(t,{'src/a.ts':'const x:any=1;'})); report.project.name='<script>alert(1)</script>'; report.findings[0].message='</script><img src=x onerror="alert(1)">';
  const html=htmlReport(report); assert.ok(!html.includes('<script>alert(1)')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('Content-Security-Policy')); assert.ok(html.includes("default-src 'none'")); assert.equal((html.match(/<script>/g)||[]).length,1);
});
test('terminal output strips injected escape sequences', t => { const report=audit(fixture(t)); report.project.name='evil\x1b[2J'; assert.ok(!terminalReport(report).includes('\x1b')); });
test('terminal colors are opt-in for API output and never leak into JSON', t => {
  const report=audit(fixture(t,{'src/a.ts':'const x:any=1;'}));
  assert.match(terminalReport(report, false, true),/\x1b\[/); assert.ok(!terminalReport(report, false, false).includes('\x1b'));
  const root=fixture(t); const result=cli([root,'--json','--color','always']); assert.ok(!result.stdout.includes('\x1b'));
  assert.equal(shouldColor('always', false),true); assert.equal(shouldColor('never', true),false); assert.equal(shouldColor('auto', false),false);
});
test('CLI JSON stdout stays machine readable', t => {
  const root=fixture(t,{'src/a.ts':'const x:any=1;'}); const result=cli([root,'--json']); assert.equal(result.status,0,result.stderr); assert.ok(JSON.parse(result.stdout).findings.length);
});
test('CLI threshold exits 1; invalid config and unsupported flags exit 2', t => {
  const root=fixture(t,{'src/a.ts':'const x:any=1;'});
  assert.equal(cli([root,'--fail-on','high']).status,1);
  assert.equal(cli([root,'--fix']).status,2);
  assert.equal(cli([root,'--changed']).status,2);
  assert.equal(cli([root,'--config','missing.yml']).status,2);
});
test('CLI HTML and JSON work together; existing files are preserved', t => {
  const root=fixture(t); const output=path.join(root,'report.html');
  const first=cli([root,'--json','--html',output]); assert.equal(first.status,0,first.stderr); assert.ok(JSON.parse(first.stdout).project); assert.ok(fs.readFileSync(output,'utf8').startsWith('<!doctype html>'));
  const second=cli([root,'--html',output]); assert.equal(second.status,2); assert.match(second.stderr,/EEXIST/);
  assert.equal(cli([root,'--html',output,'--overwrite']).status,0);
});
test('CLI lists every rule as JSON', () => { const r=cli(['--list-rules','--json']); assert.equal(r.status,0); assert.equal(JSON.parse(r.stdout).length,24); });
test('CLI creates an annotated project rules file without overwriting existing policy', t => {
  const root=fixture(t); const first=cli([root,'--init']); assert.equal(first.status,0,first.stderr);
  const file=path.join(root,'.repolens.yml'); const text=fs.readFileSync(file,'utf8');
  assert.match(text,/This file controls the checks/); assert.match(text,/no-any:/); assert.match(text,/image-alt:/); assert.doesNotThrow(()=>loadConfig(root));
  const second=cli([root,'--init']); assert.equal(second.status,2); assert.match(second.stderr,/will not overwrite/);
});
test('symlink directories are not traversed', t => {
  const root=fixture(t); const outside=fixture(t,{'src/a.ts':'this is broken {'});
  try { fs.symlinkSync(outside,path.join(root,'linked'),'junction'); } catch(error) { if(error.code==='EPERM') return t.skip('Symlink privileges unavailable'); throw error; }
  assert.equal(audit(root).statistics.filesScanned,1);
});
