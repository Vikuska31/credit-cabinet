import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { AppProvider, useApp } from './context/AppContext';
import Credits from './pages/Credits';
import Home from './pages/Home';
import Login from './pages/Login';
import Product from './pages/Product';
import Wizard from './pages/Wizard';
import Applications from './pages/Applications';
import Documents from './pages/Documents';
import Staff from './pages/Staff';
function Protected({ staff = false }: { staff?: boolean }) {
  const { isAuthenticated, checkingSession, user } = useApp();
  const location = useLocation();
  if (checkingSession) return <p>Проверяем сессию…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (staff && user?.role !== 'EMPLOYEE') return <Navigate to="/" replace />;
  if (!staff && user?.role === 'EMPLOYEE') return <Navigate to="/bank" replace />;
  return <Outlet />;
}
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="credits" element={<Credits />} />
              <Route path="product" element={<Product />} />
              <Route path="wizard" element={<Wizard />} />
              <Route path="documents" element={<Documents />} />
              <Route path="applications" element={<Applications />} />
            </Route>
          </Route>
          <Route element={<Protected staff />}>
            <Route path="bank" element={<Staff />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
