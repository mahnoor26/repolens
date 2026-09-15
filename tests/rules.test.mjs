import test from 'node:test';
import assert from 'node:assert/strict';
import { ASTAnalyzer, builtInRules } from '../dist/index.js';
import { hasName } from '../dist/rule-helpers.js';
import ts from 'typescript';

const analyzer = new ASTAnalyzer();
function run(id, source, options = {}, extra = {}) {
  const files = typeof source === 'string' ? [{ path: 'src/components/Test.tsx', text: source }] : source;
  const parsed = files.map(f => analyzer.parse(f.path, f.text));
  const context = {
    project: { root: '.', name: 'test', framework: 'React', language: 'TypeScript', dependencies: {}, state: [], styling: [], tooling: [], ...extra.project },
    files: parsed, graph: { nodes: parsed.map(f => f.path), edges: [], ...extra.graph }, config: {},
    standards: { documents: [], rules: {}, warnings: [], architectureSource: 'repolens', architecture: { apiDirectories: ['src/services'], componentDirectories: ['src/components'], hookDirectories: ['src/hooks'], folders: {}, forbiddenImports: [{ from: 'src/services', to: 'src/components' }], ...extra.architecture } },
    options: { source: 'repolens', ...options },
  };
  return builtInRules.find(r => r.id === id).check(context);
}

const cases = [
  ['missing-key', 'const X = items.map(x => <div>{x}</div>);', 'const X = items.map(x => <div key={x.id}>{x}</div>);', 'const X = items.map(x => <div {...x.props}/>);'],
  ['derived-state', 'import {useState} from "react"; function X({value}) { const [v] = useState(value); return <p>{v}</p>; }', 'import {useState} from "react"; function X() { const [v] = useState(0); return <p>{v}</p>; }', 'function useState(x) { return x; } function X(props) { const v=useState(props.value); return <p/>; }'],
  ['derived-effect', 'import {useState,useEffect} from "react"; function X(){const [a,setA]=useState(0); useEffect(()=>{setA(value*2)},[value]); return <p/>;}', 'import {useEffect} from "react"; useEffect(()=>{console.log(value)},[value]);', 'import {useState,useEffect} from "react"; const [a,setA]=useState(0); useEffect(()=>{setA(x=>x+1)},[]);'],
  ['component-max-lines', 'function X(){\n const a=1;\n const b=2;\n return <p/>;\n}', 'function X(){return <p/>}', 'function utility(){\n const a=1;\n const b=2;\n return 3;\n}', {limit:3}],
  ['component-responsibilities', 'function X(){useFoo();useBar();fetch("/x");return <p/>}', 'function X(){useFoo();useBar();return <p/>}', 'function helper(){useFoo();useBar();fetch("/x");return 1}', {limit:1}],
  ['server-state-query', 'import {useState,useEffect} from "react"; const [a,setA]=useState([]); useEffect(()=>{fetch("/x").then(x=>setA(x))},[]);', 'import {useQuery} from "@tanstack/react-query"; const data=useQuery({queryFn: getData});', 'import {useEffect} from "react"; useEffect(()=>{fetch("/telemetry")},[]);'],
  ['no-any', 'const x: any = 1;', 'const x: unknown = 1;', 'const text = "any"; // any\ninterface AnyName { value: string }'],
  ['excessive-assertions', 'const x = a as string; const y = b as number;', 'const x = a as string;', 'const x = {a:1} as const; const y = {b:2} as const;', {limit:1}],
  ['explicit-return-types', 'export function work(){return 1}', 'export function work(): number {return 1}', 'function privateWork(){return 1}'],
  ['duplicate-types', [{path:'a.ts',text:'interface A {name:string;age:number}'},{path:'b.ts',text:'type B={age:number;name:string}'}], [{path:'a.ts',text:'interface A {name:string;age:number}'},{path:'b.ts',text:'type B={age:number;id:string}'}], [{path:'a.ts',text:'interface A<T> {name:T;age:number}'},{path:'b.ts',text:'type B<T>={name:T;age:number}'}]],
  ['unsafe-typescript', 'const x = user!.name;', 'if(user) { const x=user.name; }', 'const text="// @ts-ignore"; // @ts-expect-error intentional\nfoo();'],
  ['no-api-in-components', 'fetch("/users");', [{path:'src/services/users.ts',text:'fetch("/users");'}], 'const text="fetch()"; function prefetch() {}'],
  ['import-direction', '', '', ''],
  ['circular-dependencies', '', '', ''],
  ['folder-convention', 'function X(){return <p/>}', 'function X(){return <p/>}', 'function X(){return <p/>}'],
  ['image-alt', 'const x=<img src="x"/>;', 'const x=<img src="x" alt="User"/>;', 'const x=<img src="x" alt=""/>;'],
  ['semantic-button', 'const x=<div onClick={go}>Go</div>;', 'const x=<button onClick={go}>Go</button>;', 'const x=<div role="button" tabIndex={0} onKeyDown={go} onClick={go}>Go</div>;'],
  ['form-label', 'const x=<input placeholder="Name"/>;', 'const x=<><label htmlFor="name">Name</label><input id="name"/></>;', 'const x=<input type="hidden"/>;'],
  ['nested-interactive', 'const x=<button><a href="/">Home</a></button>;', 'const x=<div><button>Go</button><a href="/">Home</a></div>;', 'const x=<button><span>Go</span></button>;'],
  ['aria-misuse', 'const x=<div aria-expanded="yes"/>;', 'const x=<div aria-expanded="true"/>;', 'const x=<div aria-expanded={expanded}/>;'],
  ['accessible-name', 'const x=<button/>;', 'const x=<button>Save</button>;', 'const x=<button aria-label="Save"><svg/></button>;'],
  ['large-imports', 'import _ from "lodash";', 'import get from "lodash/get";', 'import type {Thing} from "lodash";'],
  ['render-computation', 'function X(){const x=JSON.parse(raw);return <p>{x}</p>}', 'function X(){const x=useMemo(()=>JSON.parse(raw),[raw]);return <p>{x}</p>}', 'function parse(){return JSON.parse(raw)}'],
  ['next-image', 'const x=<img src="/x.png" alt="x"/>;', 'const x=<Image src="/x.png" alt="x"/>;', 'const x=<img alt="x"/>;'],
];

for (const [id, positive, negative, edge, options] of cases) {
  const custom = kind => {
    if (id === 'next-image') return {project:{metaFramework:'Next.js'}};
    if (id === 'folder-convention') return {architecture:{folders: kind === 'positive' ? {components:'src/ui'} : kind === 'edge' ? {} : {components:'src/components'}}};
    if (id === 'import-direction') return {graph:{nodes:['src/services/a.ts','src/components/b.ts'],edges: kind === 'positive' ? [{from:'src/services/a.ts',to:'src/components/b.ts',line:1,column:1,typeOnly:false}] : kind === 'negative' ? [{from:'src/components/b.ts',to:'src/services/a.ts',line:1,column:1,typeOnly:false}] : [{from:'src/services-old/a.ts',to:'src/components/b.ts',line:1,column:1,typeOnly:false}]}};
    if (id === 'circular-dependencies') return {graph:{nodes:['a.ts','b.ts'],edges: [{from:'a.ts',to:'b.ts',line:1,column:1,typeOnly:kind==='edge'},...(kind==='negative'?[]:[{from:'b.ts',to:'a.ts',line:1,column:1,typeOnly:false}])]}};
    return {};
  };
  test(`${id}: detects violation`, () => assert.ok(run(id, positive, options, custom('positive')).length > 0));
  test(`${id}: accepts valid code`, () => assert.equal(run(id, negative, options, custom('negative')).length, 0));
  test(`${id}: handles edge case`, () => assert.equal(run(id, edge, options, custom('edge')).length, 0));
}

test('every built-in rule has positive, negative and edge coverage', () => assert.deepEqual(cases.map(c=>c[0]).sort(), builtInRules.map(r=>r.id).sort()));
test('map block return and shorthand fragments are checked', () => assert.equal(run('missing-key','const x=items.map(x=>{return <><p/></>});').length,1));
test('conditional JSX map branches are checked separately', () => assert.equal(run('missing-key','const x=items.map(x=>x ? <p/> : <span key={x.id}/>);').length,1));
test('keys on child elements do not cover the parent', () => assert.equal(run('missing-key','const x=items.map(x=><div><p key={x.id}/></div>);').length,1));
test('missing key does not inspect returns in nested functions', () => assert.equal(run('missing-key','items.map(x=>{function Inner(){return <p/>} return <Inner key={x.id}/>});').length,0));
test('API calls include axios aliases', () => assert.equal(run('no-api-in-components','import http from "axios"; http.get("/users");').length,1));
test('API calls include XMLHttpRequest', () => assert.equal(run('no-api-in-components','const req = new XMLHttpRequest();').length,1));
test('React hook aliases are recognized', () => assert.equal(run('derived-effect','import {useState as state,useEffect as effect} from "react"; const [x,setX]=state(0); effect(()=>{setX(y*2)},[y]);').length,1));
test('React namespace hooks are recognized', () => assert.equal(run('derived-effect','import * as R from "react"; const [x,setX]=R.useState(0); R.useEffect(()=>{setX(y*2)},[y]);').length,1));
test('labels can wrap controls', () => assert.equal(run('form-label','const x=<label>Name<input/></label>').length,0));
test('empty labels do not name controls', () => assert.equal(run('form-label','const x=<><label htmlFor="x"></label><input id="x"/></>').length,1));
test('spread props are treated as unknown for labels', () => assert.equal(run('form-label','const x=<input {...props}/>').length,0));
test('hidden focusable buttons are reported', () => assert.equal(run('aria-misuse','const x=<button aria-hidden="true">Go</button>').length,1));
test('assertions as const do not count toward excess', () => assert.equal(run('excessive-assertions','const x = [1,2] as const;', {limit:1}).length,0));
test('exported arrow functions require return types when enabled', () => assert.equal(run('explicit-return-types','export const run = () => 42;').length,1));
test('ts-ignore directives are detected in comments', () => assert.equal(run('unsafe-typescript','// @ts-ignore\nconst x=1').length,1));
test('source locations point at offending node', () => { const f=run('no-any','// header\nconst x: any = 1;')[0]; assert.equal(f.line,2); assert.equal(f.column,10); });
test('accessible-name traversal handles deeply nested JSX without overflowing', () => {
  const depth = 1_000;
  const source = `<button>${'<span>'.repeat(depth)}Save${'</span>'.repeat(depth)}</button>`;
  const file = ts.createSourceFile('deep.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const opening = file.statements[0].expression.openingElement;
  assert.equal(hasName(opening), true);
});
test('anonymous default export components are measured', () => assert.equal(run('component-max-lines','export default function(){\n const a=1;\n return <p/>;\n}', {limit:2}).length,1));
