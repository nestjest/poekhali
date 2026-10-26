// Copies Pyodide runtime files into public/pyodide so nothing is loaded from a CDN.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const src = dirname(require.resolve('pyodide/package.json'));
const dst = join(import.meta.dirname, '..', 'public', 'pyodide');
const files = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
mkdirSync(dst, { recursive: true });
for (const f of files) {
  if (!existsSync(join(dst, f))) cpSync(join(src, f), join(dst, f));
}
console.log(`pyodide ${require('pyodide/package.json').version} -> public/pyodide`);
