// Shared e2e helpers: the teacher API and the layout check (no tests here).
import { expect, type APIRequestContext, type Page } from '@playwright/test';

const PASSWORD = 'e2e-pass-42';

export async function teacher(request: APIRequestContext) {
  const token = (await (await request.post('/api/teacher/login', { data: { password: PASSWORD } })).json()).token as string;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await (await request.post('/api/teacher/sessions', { data: { lesson: 0, mode: 'sync', group: 'E2E' }, headers })).json();
  const id = created.session.id as number;
  const act = async (path: string, data: unknown = {}) => {
    const r = await request.post(`/api/teacher/sessions/${id}/${path}`, { data, headers });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  const view = async () => (await request.get(`/api/teacher/sessions/${id}`, { headers })).json();
  return { token, id, code: created.session.code as string, act, view };
}

/** Problems on screen: horizontal scroll, overlapping controls (only the topmost ones count), small tap targets. */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`горизонтальный скролл: ${document.documentElement.scrollWidth} > ${vw}`);
    const name = (e: Element) => `${e.tagName.toLowerCase()}«${(e.textContent ?? '').trim().slice(0, 24) || e.getAttribute('aria-label') || ''}»`;
    const els = [...document.querySelectorAll('button, a.btn, input:not([type=checkbox]):not([type=radio]), select, textarea')].filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > vw) return false;
      if (getComputedStyle(e).visibility === 'hidden') return false;
      const hit = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
      return !!hit && (hit === e || e.contains(hit));
    });
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if ((e.tagName === 'BUTTON' || e.classList.contains('btn')) && r.height < 43.5) out.push(`мелкая цель ${name(e)}: ${Math.round(r.height)}px`);
    }
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i], b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 0.5 && h > 0.5) out.push(`пересечение ${name(a)} и ${name(b)}`);
      }
    }
    return out;
  });
}

export const SIZES = [{ width: 360, height: 740 }, { width: 1280, height: 800 }];
export const THEMES = ['light', 'dark'] as const;

