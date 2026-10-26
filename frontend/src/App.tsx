import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { useApplySettings } from './components/Shell';
import { Game } from './game/Game';
import { Plan } from './screens/Misc';

const ArtGallery = lazy(() => import('./art/ArtGallery'));
const TeacherConsole = lazy(() => import('./teacher/TeacherConsole'));
const Projector = lazy(() => import('./teacher/Projector'));
const Experts = lazy(() => import('./screens/Experts'));
const PrintKit = lazy(() => import('./screens/PrintKit'));
const StylePreview = lazy(() => import('./art/v2/StylePreview'));
const CheckGallery = lazy(() => import('./dialogue/checks/CheckGallery').then((m) => ({ default: m.CheckGallery })));

export function App() {
  useApplySettings();
  return (
    <HashRouter>
      <Suspense fallback={<p role="status" style={{ padding: 24 }}>Загрузка…</p>}>
        <Routes>
          {/* Service pages for teachers / development; the game itself has no website chrome. */}
          <Route path="/teacher" element={<TeacherConsole />} />
          <Route path="/present" element={<Projector />} />
          <Route path="/plan/:n" element={<Plan />} />
          <Route path="/print/:n" element={<PrintKit />} />
          <Route path="/experts" element={<Experts />} />
          <Route path="/style" element={<StylePreview />} />
          <Route path="/art" element={<ArtGallery />} />
          <Route path="/checks" element={<CheckGallery />} />
          <Route path="*" element={<Game />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
