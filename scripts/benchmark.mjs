import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { audit, ASTAnalyzer } from '../dist/index.js';

// Generated fixtures are created and removed only inside this fresh temp directory.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repolens-benchmark-'));
try {
  fs.mkdirSync(path.join(root, 'src', 'components'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({name:'benchmark-1000-files', dependencies:{react:'^19.0.0'}}));
  for (let i = 0; i < 1000; i++) fs.writeFileSync(path.join(root, 'src', 'components', `Item${i}.tsx`), `${i ? `import { Item${i-1} } from './Item${i-1}';\n` : ''}export function Item${i}() { return <article><h2>Item ${i}</h2>${i ? `<Item${i-1}/>` : '<p>Example</p>'}</article>; }\n`);
  const analyzer = new ASTAnalyzer();
  const cold = audit(root, { analyzer });
  const warm = audit(root, { analyzer });
  if (cold.statistics.filesScanned !== 1000 || cold.graph.edges.length !== 999 || cold.findings.length !== 0) throw new Error('Benchmark fixture validation failed');
  console.log(JSON.stringify({files:1000, edges:cold.graph.edges.length, findings:cold.findings.length, coldMs:cold.statistics.durationMs, warmMs:warm.statistics.durationMs, node:process.version, platform:process.platform}, null, 2));
} finally { fs.rmSync(root, { recursive:true, force:true }); }
