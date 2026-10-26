// UI audit of every screen: light/dark, 360 px and desktop, A+ and the readable font.
// Finds horizontal scroll, overlapping or touching controls, controls outside the viewport or clipped by their
// container, text that does not fit; saves screenshots. Needs a running lesson server with the built game:
//   cd server && BUREAU_TEACHER_PASSWORD=... python -m bureau_server --port 8010
//   node scripts/ui-audit.mjs http://localhost:8010 <password> <out dir> [screen filter]
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [base = 'http://localhost:8010', password = '', out = 'ui-audit', only = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const json = (rel) => JSON.parse(readFileSync(new URL(`../../content/${rel}`, import.meta.url), 'utf-8'));
const QUOTE_POS = json('dialogues/d0-closing.json').nodes.findIndex((n) => n.type === 'quote');
const REF_01 = json('orders/o0-1.json').reference_solution.join('\n') + '\n';

const SIZES = { phone: { width: 360, height: 740 }, desk: { width: 1366, height: 800 } };
const ALL = ['intro', 'konspekt', 'diagnostic', 'briefing', 'orders', 'review', 'closing'].map((s) => `lesson0:${s}`);
const FEATURES = ['phone', 'notebook', 'vika_chat', 'mail', 'reviews', 'shop', 'skills', 'settings', 'studio', 'desk', 'orders', 'board', 'coins', 'museum', 'orbit', 'crew'];

const save = (where, extra = {}) => JSON.stringify({
  state: {
    profile: { nick: 'Константин-Длинный', group: 'ИСП-21', avatar: 'a2' }, coins: 135, upgrades: ['plant', 'poster'], badges: ['first_run'],
    skills: {}, introduced: ['run_program', 'print', 'strings', 'variables', 'input', 'types', 'int_cast', 'float_cast', 'arithmetic', 'round', 'len', 'str_cast', 'debugging'],
    dialogues: {}, orders: {}, crews: {}, reflection: {}, stagesDone: ALL.slice(0, 4), freeHintDay: null,
    letters: [{ id: 'welcome', from: 'Вика', title: 'Добро пожаловать в бюро!', body: 'Привет!', at: 0, read: false }],
    features: FEATURES, errors: {}, launched: [], museumSeen: [], where,
    settings: { theme: 'auto', textScale: 1, readableFont: false, classic: false }, ...extra,
  }, version: 2,
});

/** Problems visible on screen (only topmost elements count, as a user sees them). */
async function problems(page) {
  return page.evaluate(() => {
    const out = [];
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`горизонтальный скролл ${document.documentElement.scrollWidth} > ${vw}`);
    const name = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''}«${((e.textContent ?? '').trim() || e.getAttribute('aria-label') || '').slice(0, 26)}»`;
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
      const st = getComputedStyle(e);
      if (st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
      const hit = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2)));
      return !!hit && (hit === e || e.contains(hit) || hit.contains(e));
    };
    const ctrls = [...document.querySelectorAll('button, a.btn, a[href], input, select, textarea, .chip, .race-row, .crew-member, .queue-item, .hotspot-label')].filter(visible);
    for (const e of ctrls) {
      const r = e.getBoundingClientRect();
      if ((e.tagName === 'BUTTON' || e.classList.contains('btn')) && r.height < 43.5 && !e.closest('.cm-editor')) out.push(`мелкая цель ${name(e)} ${Math.round(r.height)}px`);
      if (r.right > vw + 0.5 || r.left < -0.5) out.push(`за краем экрана ${name(e)}`);
      // clipped by an ancestor with overflow hidden/auto
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (st.overflowX === 'visible' && st.overflowY === 'visible') continue;
        const pr = p.getBoundingClientRect();
        if (st.overflowX !== 'visible' && (r.right > pr.right + 1 || r.left < pr.left - 1) && p.scrollWidth <= p.clientWidth + 1) out.push(`обрезано контейнером ${name(e)} в ${name(p)}`);
        break;
      }
      if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'hidden') out.push(`текст не влезает ${name(e)}`);
    }
    for (let i = 0; i < ctrls.length; i++) {
      for (let j = i + 1; j < ctrls.length; j++) {
        const a = ctrls[i], b = ctrls[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 0.5 && h > 0.5) out.push(`пересечение ${name(a)} и ${name(b)}`);
        else if ((w > 4 && h > -1 && h < 1) || (h > 4 && w > -1 && w < 1)) out.push(`вплотную (<1px) ${name(a)} и ${name(b)}`);
      }
    }
    // text clipped: block elements with hidden overflow and content wider than the box (ellipsis is intended only on .scene-title)
    for (const e of document.querySelectorAll('h1, h2, h3, p, strong, span, label, li')) {
      if (!visible(e) || e.closest('.scene-title, .cm-editor, svg, .crew-code, pre, .sr-only')) continue;
      const st = getComputedStyle(e);
      if (st.overflow === 'hidden' && e.scrollWidth > e.clientWidth + 2) out.push(`обрезан текст ${name(e)}`);
    }
    return [...new Set(out)];
  });
}

const report = [];
async function shot(page, id, wait = 700) {
  await page.waitForTimeout(wait);
  const list = await problems(page);
  await page.screenshot({ path: join(out, `${id}.png`) });
  report.push({ id, problems: list });
  console.log(`${list.length ? '✖' : '✓'} ${id}${list.length ? '\n    ' + list.slice(0, 12).join('\n    ') : ''}`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function ctx(size, theme, settings = {}) {
  const c = await browser.newContext({ viewport: SIZES[size], colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce' });
  return c;
}
async function game(size, theme, where, extra = {}, settings = {}) {
  const c = await ctx(size, theme);
  const page = await c.newPage();
  await page.goto(base + '/');
  await page.evaluate(([v]) => { localStorage.clear(); localStorage.setItem('bureau-kosmos', v); }, [save(where, { settings: { theme: 'auto', textScale: 1, readableFont: false, classic: false, ...settings }, ...extra })]);
  await page.reload();
  return { c, page };
}

const want = (id) => !only || id.includes(only);
for (const size of Object.keys(SIZES)) {
  for (const theme of ['light', 'dark']) {
    const tag = `${size}-${theme}`;
    // title + its panels
    if (want('title')) {
      const { c, page } = await game(size, theme, { kind: 'title' });
      await shot(page, `title-${tag}`, 1200);
      await page.getByRole('button', { name: 'Настройки' }).click();
      await shot(page, `title-settings-${tag}`);
      await page.getByRole('button', { name: 'Готово' }).click();
      await page.getByRole('button', { name: 'Войти в урок' }).click();
      await shot(page, `title-join-${tag}`);
      await c.close();
      const big = await game(size, theme, { kind: 'title' }, {}, { textScale: 1.6, readableFont: true });
      await shot(big.page, `title-a+-${tag}`, 1200);
      await big.page.getByRole('button', { name: 'Настройки' }).click();
      await shot(big.page, `title-settings-a+-${tag}`);
      await big.c.close();
    }
    if (want('story')) {
      const { c, page } = await game(size, theme, { kind: 'story', dialogue: 'd0-intro', stage: 'intro' }, { stagesDone: [] });
      await shot(page, `story-${tag}`, 1500);
      await c.close();
    }
    if (want('hub')) {
      const { c, page } = await game(size, theme, { kind: 'hub' });
      await shot(page, `hub-${tag}`, 1500);
      await page.getByRole('button', { name: /Телефон/ }).click();
      await shot(page, `phone-${tag}`);
      await page.locator('.phone-app', { hasText: 'Настройки' }).click();
      await shot(page, `phone-settings-${tag}`);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Пауза (Esc)' }).click();
      await shot(page, `pause-${tag}`);
      await page.getByRole('button', { name: 'Продолжить' }).click();
      await c.close();
      const big = await game(size, theme, { kind: 'hub' }, {}, { textScale: 1.6 });
      await shot(big.page, `hub-a+-${tag}`, 1500);
      await big.page.getByRole('button', { name: /Телефон/ }).click();
      await big.page.locator('.phone-app', { hasText: 'Настройки' }).click();
      await shot(big.page, `phone-settings-a+-${tag}`);
      await big.c.close();
    }
    if (want('desk')) {
      const order = { stage: 2, clarify: [0], scaffold: 3, code: {}, parsons: [], warmupDone: true, hints: 0, bestStars: 0, version: 0, needsRevision: false, submissions: [] };
      const { c, page } = await game(size, theme, { kind: 'order', id: 'o0-2' }, { orders: { 'o0-2': order }, stagesDone: ALL.slice(0, 4) });
      await shot(page, `desk-${tag}`, 2500);
      await c.close();
    }
    if (want('crew')) {
      const { c, page } = await game(size, theme, { kind: 'story', dialogue: 'd0-closing', stage: 'closing' },
        { stagesDone: ALL.slice(0, 6), dialogues: { 'd0-closing': { pos: 5, done: false, correct: 0, total: 0 } } });
      await shot(page, `crew-${tag}`, 2500);
      await c.close();
    }
    if (want('museum')) {
      // the museum app: studied / not studied exhibits and the «Цитаты дня»; then the notebook with only met topics
      const { c, page } = await game(size, theme, { kind: 'hub' }, { museumStudied: ['ps1'], quotesSeen: ['gagarin_go'] });
      await page.getByRole('button', { name: /Телефон/ }).click();
      await shot(page, `museum-phone-${tag}`);
      await page.locator('.phone-app', { hasText: 'Музей бюро' }).click();
      await shot(page, `museum-${tag}`);
      await page.getByRole('button', { name: 'Изучить' }).first().click();
      await shot(page, `museum-studied-${tag}`, 400);
      await page.getByRole('button', { name: 'Назад к приложениям' }).click();
      await page.locator('.phone-app', { hasText: 'Тетрадь' }).click();
      await shot(page, `notebook-${tag}`);
      await c.close();
      const empty = await game(size, theme, { kind: 'hub' }, { introduced: [], stagesDone: [] });
      await empty.page.getByRole('button', { name: /Телефон/ }).click();
      await empty.page.locator('.phone-app', { hasText: 'Тетрадь' }).click();
      await shot(empty.page, `notebook-empty-${tag}`);
      await empty.c.close();
    }
    if (want('quote')) {
      const { c, page } = await game(size, theme, { kind: 'story', dialogue: 'd0-closing', stage: 'closing' },
        { stagesDone: ALL.slice(0, 6), dialogues: { 'd0-closing': { pos: QUOTE_POS, done: false, correct: 0, total: 0 } } });
      await shot(page, `quote-${tag}`, 1500);
      const big = await game(size, theme, { kind: 'story', dialogue: 'd0-closing', stage: 'closing' },
        { stagesDone: ALL.slice(0, 6), dialogues: { 'd0-closing': { pos: QUOTE_POS, done: false, correct: 0, total: 0 } } }, { textScale: 1.6, readableFont: true });
      await shot(big.page, `quote-a+-${tag}`, 1500);
      await big.c.close();
      await c.close();
    }
    if (want('crewquiz')) {
      const { c, page } = await game(size, theme, { kind: 'story', dialogue: 'd0-closing', stage: 'closing' },
        { stagesDone: ALL.slice(0, 6), dialogues: { 'd0-closing': { pos: 5, done: false, correct: 0, total: 0 } } });
      await page.getByRole('button', { name: /Музейный опрос/ }).click();
      await shot(page, `crewquiz-${tag}`, 800);
      await page.locator('.crew-quiz-item').first().locator('.quiz-option').first().click();
      await shot(page, `crewquiz-answered-${tag}`, 400);
      await c.close();
    }
    if (want('museumq')) {
      // a real mission run: the reference passes the trials, the client asks the museum question
      const order = { stage: 2, clarify: [], scaffold: 3, code: { write: REF_01 }, parsons: [], warmupDone: true, hints: 0, bestStars: 0, version: 0, needsRevision: false, submissions: [] };
      const { c, page } = await game(size, theme, { kind: 'order', id: 'o0-1' }, { orders: { 'o0-1': order }, stagesDone: ALL.slice(0, 4) });
      const check = page.getByRole('button', { name: /На испытания/ });
      await check.waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /На испытания/.test(b.textContent ?? '') && !b.disabled), null, { timeout: 90_000 });
      await check.click();
      await page.getByRole('button', { name: 'К заказчику →' }).click({ timeout: 60_000 });
      for (let i = 0; i < 6 && !(await page.locator('.score-card').isVisible()); i++) {
        await page.locator('.dlg-next').click();
        await page.waitForTimeout(300);
      }
      await page.locator('.score-card').getByRole('button', { name: 'Дальше' }).click();
      await page.getByRole('button', { name: 'Просто кивнуть' }).click();
      await shot(page, `museumq-bye-${tag}`, 800);
      await page.getByRole('button', { name: /Вопрос заказчика по музею/ }).click();
      await shot(page, `museumq-${tag}`, 600);
      await page.getByRole('button', { name: 'Открыть в музее' }).click();
      await shot(page, `museumq-modal-${tag}`, 600);
      await page.locator('dialog .museum-item.focus').getByRole('button', { name: 'Изучить' }).click();
      await shot(page, `museumq-modal-studied-${tag}`, 400);
      await page.locator('dialog').getByRole('button', { name: 'Закрыть' }).click();
      await page.locator('.quiz-option').first().click();
      await shot(page, `museumq-answered-${tag}`, 400);
      await c.close();
    }
    if (want('pages')) {
      for (const path of ['plan/0', 'experts', 'print/0']) {
        const c = await ctx(size, theme);
        const page = await c.newPage();
        await page.goto(`${base}/#/${path}`);
        await shot(page, `page-${path.replace('/', '')}-${tag}`, 1200);
        await c.close();
      }
    }
    if (want('teacher') && password) {
      const c = await ctx(size, theme);
      const page = await c.newPage();
      await page.goto(`${base}/#/teacher`);
      await shot(page, `teacher-login-${tag}`);
      await page.getByLabel('Пароль преподавателя').fill(password);
      await page.getByRole('button', { name: 'Войти' }).click();
      await page.waitForTimeout(800);
      await shot(page, `teacher-sessions-${tag}`);
      await page.getByRole('button', { name: 'Начать урок и получить код' }).click();
      await page.waitForTimeout(1200);
      await shot(page, `teacher-console-${tag}`);
      const sid = await page.evaluate(() => localStorage.getItem('bureau-teacher-session'));
      // a class with crews and the race: four students, split by the console
      const tok = await page.evaluate(() => localStorage.getItem('bureau-teacher-token'));
      const code = (await (await fetch(`${base}/api/teacher/sessions/${sid}`, { headers: { Authorization: `Bearer ${tok}` } })).json()).session.code;
      for (const nick of ['Кедр', 'Чайка', 'Беркут-Длинноносый', 'Вега']) {
        await fetch(`${base}/api/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, nick, avatar: 'a3' }) });
      }
      await fetch(`${base}/api/teacher/sessions/${sid}/crews`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ action: 'auto', size: 2 }) });
      await page.waitForTimeout(1200);
      await page.locator('#crews-h').scrollIntoViewIfNeeded();
      await shot(page, `teacher-crews-${tag}`);
      await page.goto(`${base}/#/present?s=${sid}`);
      await shot(page, `teacher-present-${tag}`, 1200);
      await c.close();
    }
  }
}
await browser.close();
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.problems.length);
console.log(`\nЭкранов: ${report.length}, с замечаниями: ${bad.length}`);
