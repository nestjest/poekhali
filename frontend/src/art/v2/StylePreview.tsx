// /#/style — style v2 reference page: the task-window scene with the dialogue, line-up and every character × 5 moods.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MOODS, type Mood } from '../mood';
import { useGame } from '../../store';
import { CharacterV2, V2_IDS, V2_NAMES, type V2Id } from './CharacterV2';
import { CounterV2 } from './CounterV2';
import './v2.css';

const MOOD_RU: Record<Mood, string> = { neutral: 'спокойствие', joy: 'радость', puzzled: 'недоумение', annoyed: 'досада', thinking: 'задумчивость' };

const LINES: Record<Mood, string> = {
  neutral: 'Коллега, кружку нужна программа для «Искорки». Пусть спутник сам передаёт свой позывной.',
  joy: 'Получилось! Ребята в кружке услышали позывной и прыгали до потолка!',
  puzzled: 'Подождите… а почему на экране слово name, а не имя оператора?',
  annoyed: 'Опять пустой экран. Мы же договорились: позывной должен звучать каждый виток.',
  thinking: 'Хм. Первый спутник передавал простой сигнал. Может, и нам начать с простого?',
};

export function StylePreview() {
  const theme = useGame((s) => s.settings.theme);
  const setSettings = useGame((s) => s.setSettings);
  const [who, setWho] = useState<V2Id>('zoya');
  const [mood, setMood] = useState<Mood>('neutral');
  return (
    <div className="v2-page">
      <header className="topbar">
        <Link to="/" className="brand"><span aria-hidden="true">🚀</span><span>«Поехали!»</span></Link>
        <span className="crumbs">Пробник стиля v2</span>
        <span className="spacer" />
        <div className="row" role="group" aria-label="Тема">
          <button className="btn small" aria-pressed={theme !== 'dark'} onClick={() => setSettings({ theme: 'light' })}>День</button>
          <button className="btn small" aria-pressed={theme === 'dark'} onClick={() => setSettings({ theme: 'dark' })}>Вечер</button>
        </div>
      </header>
      <main className="page stack">
        <div className="row" role="group" aria-label="Кто у окна и настроение">
          {V2_IDS.map((id) => <button key={id} className="btn small" aria-pressed={who === id} onClick={() => setWho(id)}>{V2_NAMES[id]}</button>)}
          <span className="spacer" />
          {MOODS.map((m) => <button key={m} className="btn small ghost" aria-pressed={mood === m} onClick={() => setMood(m)}>{MOOD_RU[m]}</button>)}
        </div>

        <section className="v2-scene" aria-label="Сцена: окно заданий">
          <CounterV2 who={who} mood={mood} />
          <div className="v2-talk">
            <p className="v2-bubble"><span className="v2-name">{V2_NAMES[who]}</span>{LINES[mood]}</p>
            <div className="v2-choices">
              <button className="v2-choice main"><span className="v2-key" aria-hidden="true">1</span>Сделаю!</button>
              <button className="v2-choice"><span className="v2-key" aria-hidden="true">2</span>А какой позывной?</button>
            </div>
          </div>
        </section>

        <section className="stack-sm" aria-labelledby="h-lineup">
          <h2 id="h-lineup">Лайн-ап: у каждого своё лицо, причёска и фигура</h2>
          <div className="v2-lineup">
            {V2_IDS.map((id) => (
              <figure key={id} className="v2-card" style={{ margin: 0 }}>
                <CharacterV2 id={id} mood="neutral" size={200} />
                <figcaption className="small">{V2_NAMES[id]}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {V2_IDS.map((id) => (
          <section key={id} className="stack-sm" aria-labelledby={`h-${id}`}>
            <h2 id={`h-${id}`}>{V2_NAMES[id]} — 5 эмоций</h2>
            <div className="v2-grid">
              {MOODS.map((m) => (
                <figure key={m} className="v2-card" style={{ margin: 0 }}>
                  <CharacterV2 id={id} mood={m} size={150} />
                  <figcaption className="small">{MOOD_RU[m]}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

export default StylePreview;
