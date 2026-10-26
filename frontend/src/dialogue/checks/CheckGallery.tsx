import { useState } from 'react';
import type { Check } from '../../types';
import { CheckView, type CheckResult } from './CheckView';

const base = {
  hint: 'Подумай, что происходит по шагам.',
  explain: 'Разберём вместе: программа выполняет строки сверху вниз, одну за другой.',
  feedback_correct: 'Верно. Так и работает.',
  feedback_wrong: 'Пока не совпало. Это нормально — посмотри ещё раз на порядок действий.',
};

const samples: Check[] = [
  { ...base, kind: 'single', prompt: 'Что делает `print("Привет")`?', options: ['Показывает слово на экране', 'Стирает экран', 'Спрашивает имя'], answer: 0 },
  { ...base, kind: 'multi', prompt: 'Какие из этих имён **допустимы** для переменной?', options: ['price', '2cena', 'total_sum', 'my-name'], answer: [0, 2] },
  { ...base, kind: 'predict', prompt: 'Что напечатает программа?', code: ['x = 2', 'y = 3', 'print(x + y)'] },
  { ...base, kind: 'order', prompt: 'Собери программу приветствия по порядку.', lines: ['name = input()', 'print("Привет,", name)'] },
  { ...base, kind: 'fill', prompt: 'Заполни пропуски.', code: ['{{0}} = input()', 'print({{1}})'], chips: ['name', 'name', 'input'], answer: [0, 1] },
  { ...base, kind: 'find_bug', prompt: 'В какой строке ошибка?', code: ['name = input()', 'print(nmae)', 'print("Пока")'], answer: 2 },
  { ...base, kind: 'tiny_code', prompt: 'Напечатай слово `Привет`.', starter: ['# твой код'], reference: ['print("Привет")'], expected_stdout: ['Привет'] },
  { ...base, kind: 'match', prompt: 'Сопоставь понятие и описание.', pairs: [['input()', 'спросить у пользователя'], ['print()', 'показать на экране'], ['int()', 'сделать число']] },
];

export function CheckGallery() {
  const [log, setLog] = useState<Record<number, CheckResult[]>>({});
  return (
    <main className="stack" style={{ padding: 'var(--s4)', maxWidth: 'var(--read-width)', marginInline: 'auto' }}>
      <h1>Галерея проверок</h1>
      {samples.map((c, i) => (
        <div key={i} className="stack-sm">
          <h2 style={{ margin: 0 }}>{c.kind}</h2>
          <CheckView check={c} onDone={(r) => setLog((l) => ({ ...l, [i]: [...(l[i] ?? []), r] }))} />
          {(log[i] ?? []).map((r, k) => (
            <pre key={k} className="mono">onDone: {JSON.stringify(r)}</pre>
          ))}
        </div>
      ))}
    </main>
  );
}
