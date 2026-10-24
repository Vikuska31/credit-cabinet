import type { ReactElement } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Typography } from '@alfalab/core-components/typography';
import Layout from './components/Layout';
import { AppProvider, useApp } from './context/AppContext';
import Credits from './pages/Credits';
import Home from './pages/Home';
import Login from './pages/Login';

/** Пускает внутрь только авторизованных, остальных отправляет на /login. */
function ProtectedRoute({ children }: { children?: ReactElement }) {
  const { isAuthenticated } = useApp();
  const location = useLocation();
// ЗАГЛУШКА ЧТОБЫ МОЖНО БЫЛО ВОЙТИ
// if (!isAuthenticated) {
//   return <Navigate to="/login" replace state={{ from: location.pathname }} />;
// }
  return children ?? <Outlet />;
}

/** Заглушка для экранов следующих этапов. */
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="page-head">
      <Typography.Title tag="h1" view="large" weight="bold">
        {title}
      </Typography.Title>
      <Typography.Text view="primary-medium" color="secondary" tag="div">
        Экран будет реализован на следующем этапе.
      </Typography.Text>
      <p>
        <Link to="/">← На главную</Link>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="credits" element={<Credits />} />
              <Route path="product" element={<ComingSoon title="Страница кредита" />} />
              <Route path="wizard" element={<ComingSoon title="Заявка на кредит" />} />
              <Route path="documents" element={<ComingSoon title="Документы" />} />
              <Route path="applications" element={<ComingSoon title="Заявки" />} />
            </Route>
            {/* Экран банка — отдельный интерфейс сотрудника, без клиентского Layout */}
            <Route path="bank" element={<ComingSoon title="Заявки банка" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}