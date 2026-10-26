// Team «Конец смены»: two students of one crew write their parts, see each other's code and chat, check the program
// together and go to the launch; the race shows the first start. Layout of the crew screen (360 px, desktop, themes).
import { expect, test, type Browser, type Page } from '@playwright/test';
import { layoutProblems, SIZES, teacher, THEMES } from './helpers';

const REF: Record<string, string> = {
  input: 'craft = input()\nturns = int(input())',
  calc: 'week = turns * 7\nletters = len(craft)',
  report: 'print("Борт", craft, "на связи")\nprint("Витков за неделю:", week)\nprint("Букв в позывном:", letters)',
};
const DONE = ['intro', 'konspekt', 'diagnostic', 'briefing', 'orders', 'review'].map((s) => `lesson0:${s}`);

/** A student whose day is done up to «Конец смены», standing at the crew step of the closing scene. */
async function student(browser: Browser, join: { token: string; session: unknown; me: unknown }, nick: string): Promise<Page> {
  const page = await (await browser.newContext({ locale: 'ru-RU', reducedMotion: 'reduce' })).newPage();
  await page.goto('/');
  const game = { state: {
    profile: { nick, group: 'E2E', avatar: 'a1' }, coins: 100, upgrades: [], badges: [], skills: {}, introduced: [], orders: {}, crews: {},
    reflection: {}, stagesDone: DONE, freeHintDay: null, letters: [], features: ['phone', 'settings', 'studio'], errors: {}, launched: [],
    museumSeen: [], dialogues: { 'd0-closing': { pos: 5, done: false, correct: 0, total: 0 } },
    where: { kind: 'story', dialogue: 'd0-closing', stage: 'closing' },
    settings: { theme: 'auto', textScale: 1, readableFont: false, classic: false } }, version: 2 };
  const lesson = { state: { mode: 'lesson', token: join.token, session: join.session, me: join.me }, version: 1 };
  await page.evaluate(([g, l]) => { localStorage.setItem('bureau-kosmos', g); localStorage.setItem('bureau-lesson', l); },
    [JSON.stringify(game), JSON.stringify(lesson)]);
  await page.reload();
  return page;
}

async function writePart(page: Page, role: string, src: string) {
  const tabs = page.locator('.crew-parts-tabs');
  if (await tabs.count()) await tabs.getByRole('button', { name: role }).click();
  const editor = page.getByLabel(`Код части «${role}»`).first();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(src);
}

test('экипаж собирает программу из частей, общается в чате и стартует первым', async ({ browser, request }) => {
  const t = await teacher(request);
  const joins = [];
  for (const nick of ['Кедр', 'Чайка']) joins.push(await (await request.post('/api/join', { data: { code: t.code, nick, avatar: 'a1' } })).json());
  const view = await t.act('stage', { stage: 'closing', open: true });          // the console splits the class by itself
  expect(view.crews).toHaveLength(1);
  const crew = view.crews[0];
  const roleOf: Record<string, string> = { input: 'Оператор', calc: 'Баллистик', report: 'Связист' };

  const pages = await Promise.all(joins.map((j, i) => student(browser, j, i ? 'Чайка' : 'Кедр')));
  for (const page of pages) await expect(page.getByText(`Экипаж «${crew.name}»`)).toBeVisible({ timeout: 20_000 });

  for (const [i, page] of pages.entries()) {
    const me = crew.members.find((m: { id: number }) => m.id === joins[i].me.id);
    for (const part of me.parts as string[]) await writePart(page, roleOf[part], REF[part]);
  }
  // Each one sees the other's part live (debounced save + push).
  const other = crew.members.find((m: { parts: string[] }) => m.parts.includes('calc'));
  const viewer = pages[joins.findIndex((j) => j.me.id !== other.id)];
  const tab = viewer.getByRole('tab', { name: 'Вся программа' });
  if (await tab.isVisible()) await tab.click();
  await expect(viewer.locator('.crew-program')).toContainText('week = turns * 7', { timeout: 20_000 });

  await pages[0].getByRole('button', { name: 'Как ты назвал переменную?' }).click();
  await expect(pages[1].locator('.crew-msgs')).toContainText('Как ты назвал переменную?', { timeout: 20_000 });

  for (const theme of THEMES) {
    for (const size of SIZES) {
      await pages[1].emulateMedia({ colorScheme: theme });
      await pages[1].setViewportSize(size);
      await pages[1].waitForTimeout(200);
      expect(await layoutProblems(pages[1]), `экран экипажа ${theme} ${size.width}px`).toEqual([]);
    }
  }

  await pages[1].waitForTimeout(1500);    // the last debounced part reaches the server
  await pages[0].waitForTimeout(1500);
  await pages[1].getByRole('button', { name: /Испытать программу экипажа/ }).click();
  await expect(pages[1].locator('.crew-results')).toContainText('Испытания пройдены', { timeout: 30_000 });
  for (const page of pages) {
    await expect(page.getByRole('button', { name: 'На старт →' })).toBeVisible({ timeout: 20_000 });
  }
  await pages[0].getByRole('button', { name: 'На старт →' }).click();
  await expect(pages[0].getByText('Экипаж справился!')).toBeVisible();

  const after = await t.view();
  expect(after.race[0].start_place).toBe(1);
  expect(after.race[0].parts.start).toBe(10);
  await t.act('end');
});
