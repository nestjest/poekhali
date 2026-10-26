// /#/experts — one page for contest experts: resource passport, how to look in 3 minutes, criteria → where to see.
import { Link, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/Shell';
import { DIALOGUES, GLOSSARY, LESSONS, MUSEUM, SKILLS, lessonOrders } from '../content';
import { useGame } from '../store';

const CRITERIA: [string, string, [string, string][]][] = [
  ['1. Соответствие программе', 'ПМ.05, МДК 05.04, тема 5.4.1; у каждого занятия цель, «знать / уметь / владеть», ПК 5.8, ОК 01, 02, 04, строки программы и тайминг на 90 минут. Линтер следит, чтобы задания использовали только пройденные конструкции.',
    [['План занятия 0', '/plan/0'], ['План занятия 3', '/plan/3']]],
  ['2. Практико-ориентированность', 'Ядро — задания заказчиков: ТЗ → код → испытания → замечание → доработка → сдача. Виды: обычное, итоговое, замечание телеметрии, доработка, командное, разбор кода, срочное. Скачивание .py для Thonny / IDLE.',
    [['Игра: окно заданий', '/']]],
  ['3. Разноуровневый контроль', 'Диагностика A и B (прирост B − A), 8 типов проверок, ступени поддержки (собрать из блоков → пропуски → напиши сам), скрытые испытания с замечаниями, 1–5★, BKT по навыкам, рубрика преподавателя, отчёт CSV, опросы класса.',
    [['Галерея проверок', '/checks'], ['Печатная рубрика', '/print/1']]],
  ['4. Педагогический дизайн', 'Урок = смена в бюро; одна идея на экран; одна главная кнопка; теорию объясняют персонажи у доски; Тетрадь инженера; светлая и тёмная темы, A−/A+, читаемый шрифт, «Классика» без игрового слоя, вёрстка от 360 px.',
    [['Графика', '/art'], ['Печатные материалы', '/print/0']]],
  ['5. Интерактивность и технологии', 'Настоящий Python в браузере (Pyodide, Web Worker), один судья в браузере и на сервере (побайтово одинаковый результат), сервер урока на FastAPI + WebSocket: допуск этапов, «Внимание!», проектор с опросами, просмотр кода и комментарии.',
    [['Пульт урока', '/teacher'], ['Проектор', '/present']]],
];

export function Experts() {
  const setSettings = useGame((s) => s.setSettings);
  const go = useNavigate();
  const orders = LESSONS.flatMap((l) => lessonOrders(l));
  const checks = Object.values(DIALOGUES).reduce((n, d) => n + d.nodes.filter((x) => x.type === 'check').length, 0);
  const start = (mode: 'game' | 'classic' | 'intro') => {
    setSettings({ classic: mode === 'classic', track: mode === 'intro' ? 'intro' : 'course' });
    go('/');
  };
  return (
    <>
      <TopBar crumbs={<span>Для экспертов</span>} />
      <main className="page read experts stack">
        <h1>«Поехали!» — курс Python с нуля</h1>
        <p>Игровой курс для СПО: студент устраивается в вымышленное Бюро «Космос», пишет программы для спутников по заданиям заказчиков и запускает их на орбиту. Урок ведёт преподаватель с «Пульта урока»: без его команды класс не проходит дальше.</p>

        <section className="card stack-sm" aria-labelledby="ex-try">
          <h2 id="ex-try">Посмотреть сейчас</h2>
          <div className="row">
            <button className="btn primary" onClick={() => start('game')}>Играть</button>
            <button className="btn" onClick={() => start('classic')}>«Классика» — без игрового слоя</button>
            <button className="btn ghost" onClick={() => start('intro')}>«Знакомство» — 2 занятия</button>
          </div>
          <p className="small muted">Режим можно сменить в настройках. Прогресс хранится только в этом браузере.</p>
        </section>

        <section className="card flat stack-sm" aria-labelledby="ex-pass">
          <h2 id="ex-pass">Паспорт ресурса</h2>
          <table className="plan-table"><tbody>
            <tr><th scope="row">Программа</th><td>Специальность 09.02.07 «Информационные системы и программирование», ПМ.05, МДК 05.04 «Разработка приложений средствами языка программирования “Python”», тема 5.4.1 «Основные конструкции языка»</td></tr>
            <tr><th scope="row">Аудитория</th><td>студенты 1–2 курса СПО с нулевым уровнем программирования; режим «Знакомство» — школьники (профориентация)</td></tr>
            <tr><th scope="row">Объём</th><td>вводное занятие 0 и занятия 1–3 по 90 минут (конкурсный пакет), плюс демонстрационное занятие {LESSONS[LESSONS.length - 1]?.number} о следующих темах</td></tr>
            <tr><th scope="row">Состав</th><td>{orders.length} заданий с испытаниями, {checks} интерактивных проверок в диалогах, {SKILLS.length} навыков, {GLOSSARY.length} терминов глоссария, {MUSEUM.length} экспонатов музея (реальные факты отечественной космонавтики с источниками)</td></tr>
            <tr><th scope="row">Компетенции</th><td>ПК 5.8 «Писать программный код… производить отладку программного кода»; ОК 01–ОК 05</td></tr>
            <tr><th scope="row">Технологии</th><td>React + TypeScript, Python в браузере (Pyodide), судья на чистом Python, сервер урока FastAPI + WebSocket + SQLite; Docker с изолированной проверкой кода</td></tr>
            <tr><th scope="row">Работа без интернета</th><td>всё локально: Python, шрифты, графика; сервер урока — в локальной сети колледжа</td></tr>
            <tr><th scope="row">Персональные данные</th><td>не собираются: вход по коду урока и псевдониму</td></tr>
          </tbody></table>
        </section>

        <section className="card flat stack-sm" aria-labelledby="ex-route">
          <h2 id="ex-route">Маршрут на 3 минуты</h2>
          <ol>
            <li>«Играть» → «Самостоятельно»: первый день, пропуск, инструктаж Ольги у доски (проверки в диалоге).</li>
            <li>Окно заданий → задание 0.1: уточнение ТЗ, код в мониторе, «На испытания», замечание заказчика, сдача.</li>
            <li><Link to="/teacher">Пульт урока</Link> (нужен запущенный сервер): код урока, открытие этапов, «Внимание!», панель класса, опрос, код ученика.</li>
            <li><Link to="/plan/0">План урока</Link> и <Link to="/print/0">печатные материалы</Link>.</li>
          </ol>
        </section>

        <section className="stack-sm" aria-labelledby="ex-crit">
          <h2 id="ex-crit">Критерии → где посмотреть</h2>
          {CRITERIA.map(([title, text, links]) => (
            <article key={title} className="card flat stack-sm">
              <h3>{title}</h3>
              <p>{text}</p>
              <div className="row">{links.map(([label, to]) => <Link key={to} className="btn small ghost" to={to}>{label}</Link>)}</div>
            </article>
          ))}
          <p className="small muted">Подробная таблица с путями к файлам — в репозитории: docs/criteria-mapping.md; апробация — docs/approbation-guide.md; архитектура — docs/architecture.md.</p>
        </section>
      </main>
    </>
  );
}

export default Experts;
