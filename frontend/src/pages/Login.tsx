import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { CardImage } from '@alfalab/core-components/card-image';
import { Input } from '@alfalab/core-components/input';
import { Notification } from '@alfalab/core-components/notification';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { ApiError } from '../api/client';
import { useApp } from '../context/AppContext';

const WRONG_CREDENTIALS = 'Неверный логин или пароль. Попробуйте ещё раз';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { isAuthenticated, login } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cardLoaded, setCardLoaded] = useState(false);

  if (isAuthenticated) return <Navigate to={from} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setServerError('');

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Введите email в формате name@example.ru');
      return;
    }
    if (!password) {
      setFormError('Введите пароль');
      return;
    }
    setEmailError('');

    setSubmitting(true);
    try {
      await login(trimmed, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && [400, 401, 403].includes(err.status)) {
        setFormError(WRONG_CREDENTIALS);
        setPassword(''); // пароль не храним и не показываем повторно
      } else {
        setServerError(
          err instanceof Error ? err.message : 'Что-то пошло не так. Попробуйте позже.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo');
    setEmailError('');
    setFormError('');
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
          <Tag view="filled" size={32} className="tag tag--green">
            Удобно
          </Tag>
          <Tag view="filled" size={32} className="tag tag--green">
            Просто
          </Tag>
          <Tag view="filled" size={32} className="tag tag--green">
            Онлайн
          </Tag>
        </div>
        {/* Картинка карты грузится с CDN; пока её нет — блок скрыт, вёрстка не страдает */}
        <div className="login__card-art" hidden={!cardLoaded}>
          <CardImage
            cardId="ER"
            width={220}
            rounded
            alt=""
            onLoad={() => setCardLoaded(true)}
            onError={() => setCardLoaded(false)}
          />
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <Typography.Title tag="h2" view="medium" weight="bold">
            Вход
          </Typography.Title>
          <Typography.Text view="primary-small" color="secondary" tag="div">
            В кредитный кабинет
          </Typography.Text>

          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            block
            size={56}
            value={email}
            error={emailError || undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Пароль"
            type="password"
            name="password"
            autoComplete="current-password"
            block
            size={56}
            value={password}
            error={formError || undefined}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" view="accent" size={56} block loading={submitting}>
            Войти
          </Button>

          <div style={{ marginTop: '16px', borderTop: '1px solid #e8e9ec', paddingTop: '16px' }}>
            <Typography.Text view="secondary-small" color="secondary" tag="div" style={{ marginBottom: '12px' }}>
              Попробуйте демо-аккаунты:
            </Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button 
                type="button" 
                view="secondary" 
                size={48} 
                block
                onClick={() => fillDemo('novice@example.ru')}
              >
                ИП-новичок
              </Button>
              <Button 
                type="button" 
                view="secondary" 
                size={48} 
                block
                onClick={() => fillDemo('history@example.ru')}
              >
                ООО с историей
              </Button>
              <Button 
                type="button" 
                view="secondary" 
                size={48} 
                block
                onClick={() => fillDemo('risk@example.ru')}
              >
                Риск: просрочка
              </Button>
            </div>
          </div>
        </form>
      </section>

      <Notification
        badge="negative-alert"
        title="Нет связи с сервером"
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