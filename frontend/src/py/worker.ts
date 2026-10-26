/// <reference lib="webworker" />
// Python runtime in a Web Worker: local Pyodide + the judge package sources.
// No checking logic here — calls are forwarded to the Python judge.

const judgeFiles = import.meta.glob('@judge/*.py', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface PyodideLike {
  FS: { mkdirTree(path: string): void; writeFile(path: string, data: string): void };
  runPython(code: string): unknown;
  globals: { set(name: string, value: unknown): void };
}

let pyodide: PyodideLike | null = null;

async function boot(): Promise<PyodideLike> {
  const base = new URL(`${import.meta.env.BASE_URL}pyodide/`, self.location.origin).href;
  const mod = await import(/* @vite-ignore */ `${base}pyodide.mjs`);
  const py = (await mod.loadPyodide({ indexURL: base })) as PyodideLike;
  py.FS.mkdirTree('/home/pyodide/judge');
  for (const [path, text] of Object.entries(judgeFiles)) {
    py.FS.writeFile(`/home/pyodide/judge/${path.split('/').pop()}`, text);
  }
  py.runPython(`
import sys, json
sys.path.insert(0, "/home/pyodide")
import judge
def _call(payload):
    p = json.loads(payload)
    kind = p["kind"]
    if kind == "run_code":
        out = judge.run_code(p["source"], p.get("stdin") or [])
    elif kind == "run_order":
        out = judge.run_order(p["source"], p["order"], True, p.get("hints", 0), p.get("clarify"))
    elif kind == "run_crew":
        out = judge.run_crew(p["mission"], p.get("sources") or {}, True, p.get("hints", 0))
    elif kind == "trace":
        out = judge.trace_code(p["source"], p.get("stdin") or [])
    else:
        raise ValueError(kind)
    return judge.to_json(out)
`);
  return py;
}

const ready = boot()
  .then((py) => {
    pyodide = py;
    self.postMessage({ kind: 'ready' });
    return py;
  })
  .catch((err: unknown) => {
    self.postMessage({ kind: 'fatal', message: String(err) });
    throw err;
  });

self.onmessage = async (e: MessageEvent<{ id: number } & Record<string, unknown>>) => {
  const { id, ...payload } = e.data;
  try {
    const py = pyodide ?? (await ready);
    py.globals.set('_payload', JSON.stringify(payload));
    const json = py.runPython('_call(_payload)') as string;
    self.postMessage({ kind: 'result', id, json });
  } catch (err) {
    self.postMessage({ kind: 'error', id, message: String(err) });
  }
};
