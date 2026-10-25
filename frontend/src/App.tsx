import type { ReactElement } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Typography } from '@alfalab/core-components/typography';
import Layout from './components/Layout';
import { AppProvider, useApp } from './context/AppContext';
import Credits from './pages/Credits';
import Home from './pages/Home';
import Login from './pages/Login';
import Product from './pages/Product';
import Wizard from './pages/Wizard';
import Applications from './pages/Applications';
import Documents from './pages/Documents';

/** Пускает внутрь только авторизованных, остальных отправляет на /login. */
function ProtectedRoute({ children }: { children?: ReactElement }) {
  const { isAuthenticated } = useApp();
  const location = useLocation();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
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
              <Route path="product" element={<Product />} />
              <Route path="wizard" element={<Wizard />} />
              <Route path="documents" element={<Documents />} />
              <Route path="applications" element={<Applications />} />
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
