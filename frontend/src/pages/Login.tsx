import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { Input } from '@alfalab/core-components/input';
import { Notification } from '@alfalab/core-components/notification';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { getDemoProfiles } from '../api/auth';
import { useApp } from '../context/AppContext';
import type { DemoProfile } from '../types';

export default function Login() {
  const { login, staffLogin, demoLogin, isAuthenticated, checkingSession, user } = useApp();
  const [profiles, setProfiles] = useState<DemoProfile[]>([]);
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    getDemoProfiles()
      .then(setProfiles)
      .catch(() => setServerError('Сервер недоступен. Проверьте подключение.'));
  }, []);

  if (checkingSession) return <p>Проверяем сессию…</p>;
  if (isAuthenticated) return <Navigate to={user?.role === 'EMPLOYEE' ? '/bank' : '/'} replace />;

  const run = async (request: () => Promise<void>, demoId?: string) => {
    setBusy(true);
    setDemoBusy(demoId ?? null);
    setError('');
    setServerError('');
    try {
      await request();
    } catch (e) {
      // Ошибки логина/пароля показываем у поля, остальное — всплывающим уведомлением
      const message = e instanceof Error ? e.message : 'Ошибка входа';
      if (demoId) setServerError(message);
      else setError(message);
    } finally {
      setBusy(false);
      setDemoBusy(null);
      setPassword('');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return setError('Введите логин');
    if (!password) return setError('Введите пароль');
    void run(() => login(value.trim(), password));
  };

  return (
    <div className="login">
      <section className="login__brand">
        <div className="login__logo" aria-hidden="true">
          А
        </div>
        <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
          Альфа-Банк · Бизнес
        </Typography.Text>
        <Typography.Title tag="h1" view="xlarge" className="login__title">
          Умный кредитный кабинет предпринимателя
        </Typography.Title>
        <Typography.Text view="primary-large" color="secondary" tag="div">
          Простой путь от выбора кредита до результата
        </Typography.Text>
        <div className="login__tags">
          {['Удобно', 'Просто', 'Онлайн'].map((t) => (
            <Tag key={t} view="filled" size={32} className="tag tag--green">
              {t}
            </Tag>
          ))}
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={submit} noValidate>
          <Typography.Title tag="h2" view="medium" weight="bold">
            Вход
          </Typography.Title>
          <Typography.Text view="primary-small" color="secondary" tag="div">
            В кредитный кабинет
          </Typography.Text>

          <Input
            label="Логин"
            type="text"
            name="login"
            autoComplete="username"
            block
            size={56}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Input
            label="Пароль"
            type="password"
            name="password"
            autoComplete="current-password"
            block
            size={56}
            value={password}
            error={error || undefined}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" view="accent" size={56} block loading={busy && !demoBusy}>
            Войти
          </Button>
          <Button
            type="button"
            view="secondary"
            size={48}
            block
            disabled={busy || !value.trim() || !password}
            onClick={() => void run(() => staffLogin(value.trim(), password))}
          >
            Войти как сотрудник
          </Button>

          <div className="login__demo">
            <Typography.Text view="secondary-small" color="secondary" tag="div">
              Или войдите через демо-профиль:
            </Typography.Text>
            <div className="login__demo-list">
              {profiles.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  view="secondary"
                  size={48}
                  block
                  disabled={busy}
                  loading={demoBusy === p.id}
                  onClick={() => void run(() => demoLogin(p.id), p.id)}
                >
                  {p.title}
                </Button>
              ))}
            </div>
          </div>
        </form>
      </section>

      <Notification
        badge="negative-alert"
        title="Ошибка"
        visible={Boolean(serverError)}
        autoCloseDelay={6000}
        offset={88}
        onClose={() => setServerError('')}
        onCloseTimeout={() => setServerError('')}
        hasCloser
      >
        {serverError}
      </Notification>
    </div>
  );
}
