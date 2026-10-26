import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { getDemoProfiles } from '../api/auth';
import { useApp } from '../context/AppContext';
import type { DemoProfile } from '../types';
export default function Login() {
  const { login, staffLogin, demoLogin, isAuthenticated, checkingSession, user } = useApp();
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    getDemoProfiles()
      .then(setProfiles)
      .catch(() => setError('Сервер недоступен. Проверьте подключение.'));
  }, []);
  if (checkingSession) return <p>Проверяем сессию…</p>;
  if (isAuthenticated) return <Navigate to={user?.role === 'EMPLOYEE' ? '/bank' : '/'} replace />;
  const run = async (request: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await request();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => login(value.trim(), password));
  };
  return (
    <main className="cc-login">
      <section className="cc-card">
        <span className="cc-eyebrow">Альфа-Банк · Бизнес</span>
        <h1>Умный кредитный кабинет</h1>
        <p>От бизнес-задачи до кредитной заявки</p>
        <form className="cc-form" onSubmit={submit}>
          <label>
            Логин
            <input
              required
              autoComplete="username"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label>
            Пароль
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="cc-button" disabled={busy}>
            Войти
          </button>
          <button
            type="button"
            className="cc-button secondary"
            disabled={busy || !value.trim() || !password}
            onClick={() => void run(() => staffLogin(value.trim(), password))}
          >
            Войти как сотрудник
          </button>
        </form>
        {error && (
          <p role="alert" className="cc-error">
            {error}
          </p>
        )}
        <p>Демонстрационные профили:</p>
        <div className="cc-actions">
          {profiles.map((p) => (
            <button
              key={p.id}
              className="cc-button secondary"
              disabled={busy}
              onClick={() => void run(() => demoLogin(p.id))}
            >
              {p.title}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
