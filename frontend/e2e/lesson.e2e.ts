// «Пульт открывает этап → ученик продолжает», «Внимание!», опрос, комментарий; вёрстка служебных страниц.
import { expect, test } from '@playwright/test';
import { layoutProblems, SIZES, teacher, THEMES } from './helpers';

test('пульт открывает этап → ученик продолжает; «Внимание!», опрос, комментарий', async ({ page, request }) => {
  const t = await teacher(request);
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти в урок' }).click();
  const form = page.getByRole('form', { name: 'Вход в урок' });
  // «Грязный» ввод кода: строчные буквы и пробел вместо дефиса.
  await form.getByRole('textbox').first().fill(t.code.toLowerCase().replace('-', ' '));
  await form.getByRole('textbox').nth(1).fill('Лис');
  await form.getByRole('button', { name: 'Войти в урок' }).click();

  await expect(page.getByText('ЖДЁМ КОМАНДУ ЦУП')).toBeVisible();
  await t.act('stage', { stage: 'intro', open: true });
  await expect(page.getByText('ЖДЁМ КОМАНДУ ЦУП')).toBeHidden({ timeout: 25_000 });
  await expect(page.locator('.dlg-wrap')).toBeVisible();

  await t.act('attention', { on: true, text: 'Смотрим на доску' });
  const attention = page.getByRole('alertdialog', { name: 'Внимание!' });
  await expect(attention).toBeVisible();
  await expect(attention).toContainText('Смотрим на доску');
  await t.act('attention', { on: false, text: '' });
  await expect(attention).toBeHidden();

  await t.act('poll', { action: 'start', question: 'Готовы идти дальше?', options: ['Да', 'Нужно ещё 5 минут'] });
  const poll = page.locator('.poll-card');
  await expect(poll).toBeVisible();
  await page.waitForTimeout(500);   // after the panel's entrance animation
  for (const size of SIZES) {
    await page.setViewportSize(size);
    expect(await layoutProblems(page), `урок с опросом ${size.width}px`).toEqual([]);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/student-poll-${size.width}.png` });
  }
  await poll.getByRole('radio', { name: /Да/ }).click();
  await expect(poll.getByRole('radio', { name: /Да/ })).toHaveAttribute('aria-checked', 'true');
  expect((await t.view()).session.poll.counts).toEqual([1, 0]);

  const lis = (await t.view()).students.find((s: { nick: string }) => s.nick === 'Лис');
  await t.act(`students/${lis.id}/comment`, { text: 'Отличное начало!', order: null });
  await expect(page.getByText('Преподаватель посмотрел твой код')).toBeVisible({ timeout: 25_000 });
  await t.act('end');
});

test('проектор и пульт: опрос, код ученика', async ({ page, request }) => {
  const t = await teacher(request);
  const join = await (await request.post('/api/join', { data: { code: t.code, nick: 'Сова', avatar: 'a2' } })).json();
  await t.act('mode', { mode: 'free' });
  const r = await request.post('/api/code', { data: { order: 'o0-1', source: "print('Искорка')\n" }, headers: { Authorization: `Bearer ${join.token}` } });
  expect(r.ok()).toBeTruthy();
  await t.act('poll', { action: 'start', question: 'Что выведет print(2 + 2)?', options: ['22', '4', 'Ошибка'] });
  await page.goto('/');
  await page.evaluate(([tok, id]) => { localStorage.setItem('bureau-teacher-token', tok); localStorage.setItem('bureau-teacher-session', id); }, [t.token, String(t.id)]);

  await page.goto(`/#/present?s=${t.id}`);
  await expect(page.getByRole('heading', { name: 'Что выведет print(2 + 2)?' })).toBeVisible();
  for (const size of SIZES) {
    await page.setViewportSize(size);
    expect(await layoutProblems(page), `проектор ${size.width}px`).toEqual([]);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/present-${size.width}.png` });
  }
  await page.goto('/#/teacher');
  await page.getByRole('button', { name: 'Код ученика Сова' }).click();
  await expect(page.getByLabel('Код ученика (только чтение)')).toContainText("print('Искорка')");
  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme });
    for (const size of SIZES) {
      await page.setViewportSize(size);
      expect(await layoutProblems(page), `код ученика ${theme} ${size.width}px`).toEqual([]);
    }
  }
  await t.act('end');
});

for (const route of ['/#/experts', '/#/print/0', '/#/plan/0', '/#/teacher']) {
  test(`вёрстка ${route}: светлая/тёмная, 360 px и десктоп`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      for (const size of SIZES) {
        await page.setViewportSize(size);
        expect(await layoutProblems(page), `${route} ${theme} ${size.width}px`).toEqual([]);
        if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/${route.replace(/\W+/g, '_')}-${theme}-${size.width}.png` });
      }
    }
  });
}

test('титул: режим «Знакомство»', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Знакомство/ }).click();
  await expect(page.getByRole('heading', { name: 'Режим «Знакомство»' })).toBeVisible();
  for (const size of SIZES) {
    await page.setViewportSize(size);
    expect(await layoutProblems(page), `панель «Знакомство» ${size.width}px`).toEqual([]);
  }
  await page.getByRole('button', { name: 'Начать знакомство' }).click();
  const saved = await page.evaluate(() => Object.values({ ...localStorage }).some((v) => String(v).includes('"track":"intro"')));
  expect(saved).toBe(true);
});
