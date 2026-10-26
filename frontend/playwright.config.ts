// End-to-end tests in a real browser: the built game + the lesson server (python -m bureau_server).
//   npm run build && npm run test:e2e
// Uses the installed Google Chrome (channel «chrome»), nothing is downloaded.
import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8010;
// E2E_DATABASE_URL=postgresql://… runs the same tests on PostgreSQL (the Vercel setup).
const db = process.env.E2E_DATABASE_URL ?? join(tmpdir(), `bureau-e2e-${Date.now()}.db`);

// E2E_BASE_URL=https://… E2E_PASSWORD=… runs the tests against a deployed server (Vercel) instead of a local one.
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',      // not *.spec.ts / *.test.ts: those belong to Vitest
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: remote ?? `http://localhost:${PORT}`, channel: 'chrome', headless: true, locale: 'ru-RU' },
  webServer: remote ? undefined : {
    command: `python -m bureau_server --host 127.0.0.1 --port ${PORT} --db "${db}"`,
    cwd: '../server',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    // Test-only password and the isolated local checker (the lesson server itself never runs code).
    env: { BUREAU_TEACHER_PASSWORD: 'e2e-pass-42', BUREAU_LOCAL_CHECK: '1', PYTHONIOENCODING: 'utf-8' },
  },
});
