import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { SessionPage } from './pages/SessionPage';
import { DebugPage } from './pages/DebugPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="session/:id" element={<SessionPage />} />
        <Route path="debug/:id" element={<DebugPage />} />
      </Route>
    </Routes>
  );
}
