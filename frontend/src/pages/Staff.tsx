import { useEffect, useState } from 'react';
import { Button } from '@alfalab/core-components/button';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { getApplications, getApplication } from '../api/applications';
import { fetchApi } from '../api/client';
import { getGoals } from '../api/catalog';
import { useApp } from '../context/AppContext';
import type { Application, GoalInfo } from '../types';
import { formatRub } from '../utils/format';
import { STATUS_TONE } from '../utils/status';
import styles from './Staff.module.css';
interface Inquiry {
  id: string;
  text: string;
  companyInn: string;
  status: string;
}
export default function Staff() {
  const { user, logout } = useApp();
  const [apps, setApps] = useState<Application[]>([]);
  const [goals, setGoals] = useState<GoalInfo[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [field, setField] = useState('');
  const load = async () => {
    const [a, q] = await Promise.all([
      getApplications(),
      fetchApi<Inquiry[]>('/api/staff/goal-inquiries'),
    ]);
    setApps(a);
    setInquiries(q);
  };
  useEffect(() => {
    getGoals()
      .then(setGoals)
      .catch((e) => setError(e.message));
    Promise.all([getApplications(), fetchApi<Inquiry[]>('/api/staff/goal-inquiries')])
      .then(([a, q]) => {
        setApps(a);
        setInquiries(q);
      })
      .catch((e) => setError(e.message));
  }, []);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      await load();
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <Typography.Title tag="h1" view="large" weight="bold">
          Кабинет сотрудника
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary">
          {user?.fullName}
        </Typography.Text>
        <Button view="secondary" size={40} onClick={logout}>
          Выйти
        </Button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.grid}>
        <section className={styles.card}>
          <Typography.Title tag="h2" view="small" weight="bold">
            Отправленные заявки
          </Typography.Title>
          {apps.length === 0 && (
            <Typography.Text view="primary-medium" color="secondary" tag="div">
              Заявок нет.
            </Typography.Text>
          )}
          <ul className={styles.list}>
            {apps.map((a) => (
              <li className={styles.row} key={a.id}>
                <Button
                  view="text"
                  size={32}
                  onClick={() => void run(async () => setSelected(await getApplication(a.id)))}
                >
                  № {a.number} · {a.companyInn}
                </Button>
                <Tag view="filled" size={32} className={`tag tag--${STATUS_TONE[a.status]}`}>
                  {a.statusTitle}
                </Tag>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.card}>
          <Typography.Title tag="h2" view="small" weight="bold">
            Вопросы по цели
          </Typography.Title>
          <label className={styles.field}>
            Предложить категорию
            <select
              aria-label="Предложить категорию"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Только уточняющий вопрос</option>
              {goals
                .filter((g) => g.code !== 'OTHER')
                .map((g) => (
                  <option value={g.code} key={g.code}>
                    {g.title}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.field}>
            Ответ клиенту
            <textarea
              aria-label="Ответ клиенту"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          {inquiries.length === 0 && (
            <Typography.Text view="primary-medium" color="secondary" tag="div">
              Нет открытых вопросов.
            </Typography.Text>
          )}
          {inquiries.map((q) => (
            <article className={styles.inquiry} key={q.id}>
              <p>
                {q.companyInn}: {q.text}
              </p>
              <Button
                view="accent"
                size={40}
                disabled={busy || (!message.trim() && !category)}
                onClick={() =>
                  void run(() =>
                    fetchApi('/api/staff/goal-inquiries/' + q.id + '/answer', {
                      method: 'POST',
                      body: JSON.stringify({ category: category || null, message }),
                    }),
                  )
                }
              >
                Ответить на вопрос
              </Button>
            </article>
          ))}
        </section>
      </div>
      {selected && (
        <section className={styles.card}>
          <Typography.Title tag="h2" view="small" weight="bold">
            Заявка № {selected.number}
          </Typography.Title>
          <Typography.Text view="primary-medium" tag="div">
            {selected.statusTitle} ·{' '}
            {selected.amount == null ? 'Сумма не указана' : formatRub(selected.amount)} ·{' '}
            {selected.termMonths} мес.
          </Typography.Text>
          {selected.decision?.reasons.map((r) => (
            <Typography.Text view="primary-small" color="secondary" tag="div" key={r.code}>
              {r.text}
            </Typography.Text>
          ))}
          <Typography.Title tag="h3" view="xsmall" weight="bold">
            Запросить уточнение
          </Typography.Title>
          <label className={styles.field}>
            Какое поле или документ уточнить
            <input
              aria-label="Поле уточнения"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="Например, назначение средств"
            />
          </label>
          <label className={styles.field}>
            Сообщение клиенту
            <textarea
              aria-label="Сообщение клиенту"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <div>
            <Button
              view="accent"
              size={48}
              disabled={
                busy ||
                !message.trim() ||
                !['UNDER_REVIEW', 'NEEDS_CLARIFICATION', 'APPROVED', 'COUNTER_OFFERED'].includes(
                  selected.status,
                )
              }
              onClick={() =>
                void run(async () =>
                  setSelected(
                    await fetchApi<Application>(
                      '/api/staff/applications/' + selected.id + '/clarification-requests',
                      {
                        method: 'POST',
                        body: JSON.stringify({ field, documentType: null, message }),
                      },
                    ),
                  ),
                )
              }
            >
              Отправить запрос
            </Button>
          </div>
          <Typography.Title tag="h3" view="xsmall" weight="bold">
            История
          </Typography.Title>
          <ul className={styles.history}>
            {selected.history.map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleString('ru-RU')} · {h.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
