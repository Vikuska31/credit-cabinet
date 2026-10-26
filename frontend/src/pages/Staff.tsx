import { useEffect, useState } from 'react';
import { getApplications, getApplication } from '../api/applications';
import { fetchApi } from '../api/client';
import { getGoals } from '../api/catalog';
import { useApp } from '../context/AppContext';
import type { Application, GoalInfo } from '../types';
import { formatRub } from '../utils/format';
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
    <main className="cc-staff">
      <div className="cc-actions">
        <h1>Кабинет сотрудника</h1>
        <span>{user?.fullName}</span>
        <button className="cc-button secondary" onClick={logout}>
          Выйти
        </button>
      </div>
      {error && (
        <p role="alert" className="cc-error">
          {error}
        </p>
      )}
      <div className="cc-grid">
        <section className="cc-card">
          <h2>Отправленные заявки</h2>
          {apps.length === 0 && <p>Заявок нет.</p>}
          {apps.map((a) => (
            <p key={a.id}>
              <button
                className="cc-link"
                onClick={() => void run(async () => setSelected(await getApplication(a.id)))}
              >
                № {a.number} · {a.companyInn} · {a.statusTitle}
              </button>
            </p>
          ))}
        </section>
        <section className="cc-card">
          <h2>Вопросы по цели</h2>
          <label>
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
          <label>
            Ответ клиенту
            <textarea
              aria-label="Ответ клиенту"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          {inquiries.length === 0 && <p>Нет открытых вопросов.</p>}
          {inquiries.map((q) => (
            <article className="cc-notice" key={q.id}>
              <p>
                {q.companyInn}: {q.text}
              </p>
              <button
                className="cc-button"
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
              </button>
            </article>
          ))}
        </section>
      </div>
      {selected && (
        <section className="cc-card">
          <h2>Заявка № {selected.number}</h2>
          <p>
            {selected.statusTitle} ·{' '}
            {selected.amount == null ? 'Сумма не указана' : formatRub(selected.amount)} ·{' '}
            {selected.termMonths} мес.
          </p>
          {selected.decision?.reasons.map((r) => (
            <p key={r.code}>{r.text}</p>
          ))}
          <h3>Запросить уточнение</h3>
          <label>
            Какое поле или документ уточнить
            <input
              aria-label="Поле уточнения"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="Например, назначение средств"
            />
          </label>
          <label>
            Сообщение клиенту
            <textarea
              aria-label="Сообщение клиенту"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button
            className="cc-button"
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
          </button>
          <h3>История</h3>
          {selected.history.map((h, i) => (
            <p key={i}>
              {new Date(h.at).toLocaleString('ru-RU')} · {h.message}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
