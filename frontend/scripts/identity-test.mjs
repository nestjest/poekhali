// Identity test: the same code + order must give byte-identical structured results
// in CPython (checker) and Pyodide (browser). Run: npm run test:identity
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadPyodide } from 'pyodide';

const root = join(import.meta.dirname, '..', '..');
const judgeDir = join(root, 'packages', 'judge', 'judge');
const ordersDir = join(root, 'content', 'orders');
const code = (c) => (Array.isArray(c) ? c.join('\n') + '\n' : c ?? '');

const cases = [];
for (const f of readdirSync(ordersDir).sort()) {
  const order = JSON.parse(readFileSync(join(ordersDir, f), 'utf8'));
  const sources = { ref: order.reference_solution, starter: order.starter_code, fill: order.fill_code };
  for (const [kind, src] of Object.entries(sources)) {
    if (src !== undefined) cases.push({ name: `${f}:${kind}`, kind: 'order', source: code(src), order });
  }
}
const crewsDir = join(root, 'content', 'crews');
for (const f of readdirSync(crewsDir).sort()) {
  const mission = JSON.parse(readFileSync(join(crewsDir, f), 'utf8'));
  const ref = Object.fromEntries(mission.parts.map((p) => [p.id, code(p.reference)]));
  cases.push({ name: `${f}:ref`, kind: 'crew', mission, sources: ref });
  cases.push({ name: `${f}:templates`, kind: 'crew', mission, sources: {} });
}
const extra = [
  ['loop', 'while True:\n    x = 1\n', []],
  ['print-loop', 'while True:\n    print("a" * 50)\n', []],
  ['errors', 'a = input()\nprint(a + 1)\n', ['5']],
  ['floats', 'x = float(input())\nprint(round(x * 3.3333, 2), 10 / 3)\n', ['2.5']],
];
for (const [name, source, stdin] of extra) {
  cases.push({ name: `${name}:run`, kind: 'run', source, stdin });
  cases.push({ name: `${name}:trace`, kind: 'trace', source, stdin });
}

const RUNNER = `
import json, sys
sys.path.insert(0, %PATH%)
import judge
def call(c):
    if c["kind"] == "order":
        return judge.run_order(c["source"], c["order"])
    if c["kind"] == "crew":
        return judge.run_crew(c["mission"], c["sources"])
    if c["kind"] == "run":
        return judge.run_code(c["source"], c["stdin"])
    return judge.trace_code(c["source"], c["stdin"])
`;
const cpy = RUNNER.replace('%PATH%', JSON.stringify(join(root, 'packages', 'judge'))) +
  'cases = json.loads(sys.stdin.read())\nprint(json.dumps([judge.to_json(call(c)) for c in cases]))\n';
const cpython = JSON.parse(execFileSync('python', ['-X', 'utf8', '-c', cpy],
  { input: JSON.stringify(cases), maxBuffer: 1 << 28 }).toString('utf8'));

const py = await loadPyodide();
py.FS.mkdirTree('/home/pyodide/judge');
for (const f of readdirSync(judgeDir).filter((n) => n.endsWith('.py'))) {
  py.FS.writeFile(`/home/pyodide/judge/${f}`, readFileSync(join(judgeDir, f), 'utf8'));
}
py.globals.set('_cases', JSON.stringify(cases));
const pyodideOut = JSON.parse(py.runPython(RUNNER.replace('%PATH%', '"/home/pyodide"') +
  'json.dumps([judge.to_json(call(c)) for c in json.loads(_cases)])\n'));

let failed = 0;
cases.forEach((c, i) => {
  const same = cpython[i] === pyodideOut[i];
  if (!same) failed++;
  console.log(`${same ? 'OK  ' : 'DIFF'} ${c.name} (${cpython[i].length} bytes)`);
  if (!same) console.log('  cpython:', cpython[i].slice(0, 300), '\n  pyodide:', pyodideOut[i].slice(0, 300));
});
console.log(`\nCPython ${execFileSync('python', ['--version']).toString().trim()} vs Pyodide ${py.version}: ${cases.length - failed}/${cases.length} identical`);
process.exit(failed ? 1 : 0);
