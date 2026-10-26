import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { Typography } from '@alfalab/core-components/typography';
import { useApp } from '../context/AppContext';
import { getInitials } from '../utils/format';
import AssistantPanel from './ai/AssistantPanel';

const NAV_ITEMS = [
  { to: '/', label: 'Главная', icon: '⌂', end: true },
  { to: '/credits', label: 'Кредиты', icon: '◈', end: false },
  { to: '/applications', label: 'Заявки', icon: '▤', end: false },
  { to: '/documents', label: 'Документы', icon: '▣', end: false },
];

function UserMenu() {
  const { user, logout } = useApp();
  const navigate = useNavigate(); // Добавили хук для навигации
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = user?.fullName ?? user?.firstName;

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Профиль"
        onClick={() => setOpen((v) => !v)}
      >
        {getInitials(name)}
      </button>
      {open && (
        <div className="user-menu__popup" role="menu">
          <Typography.Text view="primary-medium" weight="bold" tag="div">
            {name ?? 'Профиль'}
          </Typography.Text>
          {user?.companyName && (
            <Typography.Text view="secondary-small" color="secondary" tag="div">
              {user.companyName}
            </Typography.Text>
          )}
          {user?.inn && (
            <Typography.Text view="secondary-small" color="secondary" tag="div">
              ИНН {user.inn}
            </Typography.Text>
          )}
          <Button
            view="outlined"
            size={40}
            block
            className="user-menu__logout"
            onClick={() => {
              setOpen(false);
              logout();
              navigate('/login', { replace: true }); // Принудительный выход на логин
            }}
          >
            Выйти
          </Button>
        </div>
      )}
    </div>
  );
}

/** Каркас внутренних экранов: шапка, боковое меню и область контента. */
export default function Layout() {
  const navigate = useNavigate();

  return (
    <div className="layout">
      <header className="header">
        <NavLink to="/" className="brand" aria-label="На главную">
          <span className="brand__mark">А</span>
          <span className="brand__name">Кредитный кабинет</span>
        </NavLink>

        <nav className="header__nav" aria-label="Быстрые действия">
          <Button view="accent" size={40} onClick={() => navigate('/credits')}>
            Подобрать кредит
          </Button>
        </nav>

        <UserMenu />
      </header>

      <div className="layout__body">
        <aside className="sidebar">
          <nav className="sidebar__nav" aria-label="Основное меню">
            {NAV_ITEMS.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              >
                <span className="sidebar__icon" aria-hidden="true">
                  {icon}
                </span>
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="content">
          <Outlet />
          <AssistantPanel />
        </main>
      </div>
    </div>
  );
}
