import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Character, CharacterArt, CHARACTER_IDS, CHARACTER_NAMES, MOODS } from './Character';
import type { CharacterId, Mood } from './Character';
import { Avatar, AVATAR_IDS } from './Avatar';
import { StudioRoom, HOTSPOT_ANCHORS, HOTSPOT_IDS, ROOM_UPGRADES } from './StudioRoom';
import type { HotspotId } from './StudioRoom';
import { ClientCounter } from './ClientCounter';
import { Location, LOCATION_IDS, LOCATION_TIMES } from './Locations';
import { TitleArt } from './TitleArt';
import { OrbitMap } from './OrbitMap';
import type { OrbitCraft } from './OrbitMap';
import { LaunchScene } from './LaunchScene';
import { EXHIBIT_ART_IDS, EXHIBIT_ART_NAMES, ExhibitArt } from './Museum';
import { useGame } from '../store';

const LABELS: Record<HotspotId, string> = {
  orders: 'Окно заданий', desk: 'Рабочее место', board: 'Доска заданий', cabinet: 'Шкаф-архив',
  mail: 'Пневмопочта', shop: 'Склад оснащения', reviews: 'Журнал миссий', door: 'Уйти домой',
  museum: 'Музей бюро', orbit: 'Карта орбит',
};

const EXAMPLE_CRAFTS: OrbitCraft[] = [
  { id: 'iskorka', name: 'Искорка', orbit: 'leo', launched: true },
  { id: 'oblachko', name: 'Облачко', orbit: 'sso', launched: true },
  { id: 'severok', name: 'Северок', orbit: 'geo', launched: true },
  { id: 'dozor', name: 'Дозор', orbit: 'sso', launched: true },
  { id: 'kedr', name: 'Кедр', orbit: 'meo', launched: true },
  { id: 'chayka', name: 'Чайка', orbit: 'leo', launched: true },
  { id: 'later', name: 'Ещё не запущен', orbit: 'leo', launched: false },
];

const LOCATION_RU: Record<string, string> = {
  street: 'Проходная', reception: 'Бюро пропусков', board: 'Класс подготовки', desk: 'Рабочее место',
  counter: 'Окно заданий', launch: 'Стартовый стол',
};

const section: CSSProperties = { margin: '0 auto var(--s5)', maxWidth: 1200, padding: '0 var(--s3)' };
const grid: CSSProperties = { display: 'grid', gap: 'var(--s2)', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' };
const cell: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s1)',
  padding: 'var(--s2)', background: 'var(--surface)', border: '2px solid var(--c-ink-bg)', borderRadius: 'var(--r2)',
  fontSize: 'var(--fs-small)',
};

function RoomWithLabels({ upgrades, tilt, satellites }: { upgrades: string[]; tilt?: { x: number; y: number }; satellites?: number }) {
  const [last, setLast] = useState<string>('—');
  return (
    <div>
      <div style={{ position: 'relative', border: '2px solid var(--c-ink)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
        <StudioRoom
          upgrades={upgrades} labels={LABELS} tilt={tilt} onHotspot={(id) => setLast(id)}
          badges={{ mail: 3, orders: 12 }} satellites={satellites}
        />
        {HOTSPOT_IDS.map((id) => (
          <span
            key={id}
            style={{
              position: 'absolute', left: `${(HOTSPOT_ANCHORS[id].x / 1200) * 100}%`,
              top: `${(HOTSPOT_ANCHORS[id].y / 700) * 100}%`, transform: 'translate(-50%, -50%)',
              padding: 'var(--s1) var(--s2)', background: 'var(--surface)', border: '2px solid var(--c-ink-bg)',
              borderRadius: 'var(--r-pill)', fontSize: 'var(--fs-small)', whiteSpace: 'nowrap', pointerEvents: 'none',
              color: 'var(--text)',
            }}
          >
            {LABELS[id]}
          </span>
        ))}
      </div>
      <p style={{ color: 'var(--muted)' }}>Последний клик: {last}</p>
    </div>
  );
}

export function ArtGallery() {
  const [client, setClient] = useState<CharacterId>('zoya');
  const [launch, setLaunch] = useState<'off' | 'full' | 'reduced'>('off');
  const [mood, setMood] = useState<Mood>('neutral');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const theme = useGame((st) => st.settings.theme);
  const setSettings = useGame((st) => st.setSettings);
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', padding: 'var(--s4) 0', fontFamily: 'var(--font-ui)' }}>
      <section style={{ ...section, display: 'flex', gap: 'var(--s2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, marginRight: 'auto' }}>Галерея графики: стиль v2</h1>
        <button type="button" style={{ minHeight: 'var(--tap)', padding: '0 var(--s3)' }} aria-pressed={theme !== 'dark'} onClick={() => setSettings({ theme: 'light' })}>День</button>
        <button type="button" style={{ minHeight: 'var(--tap)', padding: '0 var(--s3)' }} aria-pressed={theme === 'dark'} onClick={() => setSettings({ theme: 'dark' })}>Вечер</button>
      </section>

      <section style={section}>
        <h2>Персонажи × настроения</h2>
        <div style={grid}>
          {CHARACTER_IDS.flatMap((id) => MOODS.map((m) => (
            <div key={`${id}-${m}`} style={cell}>
              <Character id={id} mood={m} size={120} />
              <span>{CHARACTER_NAMES[id]}</span>
              <span style={{ color: 'var(--muted)' }}>{m}</span>
            </div>
          )))}
        </div>
      </section>

      <section style={section}>
        <h2>Громов × настроения</h2>
        <div style={grid}>
          {MOODS.map((m) => (
            <div key={m} style={cell}>
              <Character id="gromov" mood={m} size={140} />
              <span>{CHARACTER_NAMES.gromov}</span>
              <span style={{ color: 'var(--muted)' }}>{m}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2>Портреты 64px</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)' }}>
          {CHARACTER_IDS.map((id) => <Character key={id} id={id} size={64} />)}
        </div>
      </section>

      <section style={section}>
        <h2>Аватары</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s3)', alignItems: 'center' }}>
          {AVATAR_IDS.map((id) => (
            <div key={id} style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
              <Avatar id={id} size={96} />
              <Avatar id={id} size={48} />
              <Avatar id={id} size={32} />
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2>Зал бюро: все улучшения ({ROOM_UPGRADES.join(', ')})</h2>
        <label style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', marginBottom: 'var(--s2)' }}>
          Параллакс
          <input
            type="range" min={-1} max={1} step={0.1} value={tilt.x}
            onChange={(e) => setTilt({ x: Number(e.target.value), y: tilt.y })}
          />
          <input
            type="range" min={-1} max={1} step={0.1} value={tilt.y}
            onChange={(e) => setTilt({ x: tilt.x, y: Number(e.target.value) })}
          />
        </label>
        <RoomWithLabels upgrades={[...ROOM_UPGRADES]} tilt={tilt} satellites={6} />
      </section>

      <section style={section}>
        <h2>Зал бюро: без улучшений</h2>
        <RoomWithLabels upgrades={[]} />
      </section>

      <section style={section}>
        <h2>Зал бюро: enabled=[orders, desk], highlight=orders</h2>
        <div style={{ border: '2px solid var(--c-ink)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
          <StudioRoom upgrades={['plant', 'poster']} labels={LABELS} enabled={['orders', 'desk']} highlight="orders" onHotspot={() => undefined} />
        </div>
      </section>

      <section style={section}>
        <h2>Локации × время суток</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s3)' }}>
          {LOCATION_IDS.filter((id) => id !== 'studio').flatMap((id) => LOCATION_TIMES.map((t) => (
            <figure key={`${id}-${t}`} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s1)' }}>
              <div style={{ width: 384, maxWidth: '100%', aspectRatio: '16 / 9', border: '2px solid var(--c-ink-bg)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                <Location id={id} time={t} />
              </div>
              <figcaption style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{LOCATION_RU[id]} ({id}) / {t}</figcaption>
            </figure>
          )))}
        </div>
      </section>

      <section style={section}>
        <h2>Локации с персонажем по центру (нижняя треть спокойна)</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s3)' }}>
          {LOCATION_IDS.filter((id) => id !== 'studio').map((id) => (
            <figure key={id} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s1)' }}>
              <div style={{ position: 'relative', width: 480, maxWidth: '100%', aspectRatio: '16 / 9', border: '2px solid var(--c-ink-bg)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                <Location id={id} time="day" />
                <svg viewBox="0 0 240 300" aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: '-8%', width: '33.75%', transform: 'translateX(-50%)' }}>
                  <CharacterArt id="vika" mood="neutral" />
                </svg>
              </div>
              <figcaption style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{LOCATION_RU[id]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2>Титульная иллюстрация</h2>
        <div style={{ width: '100%', maxWidth: 960, aspectRatio: '16 / 9', border: '2px solid var(--c-ink)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
          <TitleArt />
        </div>
      </section>

      <section style={section}>
        <h2>Окно заданий</h2>
        <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap', marginBottom: 'var(--s2)' }}>
          <select value={client} onChange={(e) => setClient(e.target.value as CharacterId)}>
            {CHARACTER_IDS.map((id) => <option key={id} value={id}>{CHARACTER_NAMES[id]}</option>)}
          </select>
          <select value={mood} onChange={(e) => setMood(e.target.value as Mood)}>
            {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ maxWidth: 800 }}>
          <ClientCounter clientId={client} mood={mood} />
        </div>
      </section>

      <section style={section}>
        <h2>Карта орбит</h2>
        <div style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', maxWidth: 720 }}><OrbitMap crafts={EXAMPLE_CRAFTS} /></div>
          <div style={{ flex: '1 1 300px', maxWidth: 400 }}><OrbitMap crafts={[]} /></div>
        </div>
      </section>

      <section style={section}>
        <h2>Музей: экспонаты</h2>
        <div style={grid}>
          {EXHIBIT_ART_IDS.map((id) => (
            <div key={id} style={cell}>
              <ExhibitArt id={id} size={140} />
              <span>{EXHIBIT_ART_NAMES[id]}</span>
              <span style={{ color: 'var(--muted)' }}>{id}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2>Запуск</h2>
        <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
          <button type="button" style={{ minHeight: 'var(--tap)', padding: '0 var(--s3)' }} onClick={() => setLaunch('full')}>Проиграть запуск</button>
          <button type="button" style={{ minHeight: 'var(--tap)', padding: '0 var(--s3)' }} onClick={() => setLaunch('reduced')}>Проиграть без движения</button>
        </div>
        {launch !== 'off' && (
          <LaunchScene craft="Искорка" reduced={launch === 'reduced'} onDone={() => setLaunch('off')} />
        )}
      </section>
    </div>
  );
}

export default ArtGallery;
