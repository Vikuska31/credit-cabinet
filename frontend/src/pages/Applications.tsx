import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applicationAction, getApplication } from '../api/applications';
import { fetchApi } from '../api/client';
import { getDocuments } from '../api/catalog';
import { useApp } from '../context/AppContext';
import type { Application, DocumentRef } from '../types';
import { APPLICATION_STATUS_LABELS } from '../types';
import { formatRub } from '../utils/format';
import { GOAL_LABELS, OFFER_FIELD_LABELS } from '../utils/goals';
interface Inquiry {
  id: string;
  text: string;
  status: string;
  suggestedCategory: string | null;
  employeeMessage: string | null;
}
export default function Applications() {
  const { applications, applicationsStatus, applicationsError, refreshApplications } = useApp();
  const [params, setParams] = useSearchParams();
  const id = params.get('applicationId');
  const [opened, setOpened] = useState<Application | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<DocumentRef[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  useEffect(() => {
    let active = true;
    if (id)
      Promise.all([getApplication(id), getDocuments()])
        .then(([a, d]) => {
          if (active) {
            setOpened(a);
            setLibrary(d);
            setAttached(a.attachedDocumentIds);
          }
        })
        .catch((e) => {
          if (active) {
            setOpened(null);
            setError(e.message);
          }
        });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    fetchApi<Inquiry[]>('/api/goal-inquiries')
      .then(setInquiries)
      .catch(() => undefined);
  }, []);
  const act = async (action: Parameters<typeof applicationAction>[1], body?: object) => {
    if (!id || busy) return;
    setBusy(true);
    setError('');
    try {
      const a = await applicationAction(id, action, body);
      setOpened(a);
      setAttached(a.attachedDocumentIds);
      await refreshApplications();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка операции');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-head">
        <h1>Мои заявки</h1>
        <Link className="cc-button" to="/credits">
          Подобрать кредит
        </Link>
      </div>
      {(error || applicationsError) && (
        <p role="alert" className="cc-error">
          {error || applicationsError}
        </p>
      )}
      {applicationsStatus === 'loading' && <p>Загрузка…</p>}
      {applications.length === 0 && applicationsStatus === 'success' && <p>Заявок пока нет.</p>}
      <div className="cc-list">
        {applications.map((a) => (
          <article className="cc-card" key={a.id}>
            <span className="cc-badge">{APPLICATION_STATUS_LABELS[a.status]}</span>
            <h2>Заявка № {a.number}</h2>
            <p>
              {a.amount == null ? 'Сумма не указана' : formatRub(a.amount)} · {a.termMonths ?? '—'}{' '}
              мес.
            </p>
            <button
              className="cc-button secondary"
              onClick={() => {
                setError('');
                setOpened(null);
                setParams({ applicationId: a.id });
              }}
            >
              Подробнее
            </button>
          </article>
        ))}
      </div>
      {id && opened?.id === id && (
        <section className="cc-card cc-detail">
          <div className="cc-actions">
            <h2>Заявка № {opened.number}</h2>
            <button
            className="cc-button secondary"
              onClick={() => {
                setOpened(null);
                setParams({});
              }}
            >
              Закрыть
            </button>
          </div>
          <p>{opened.statusTitle}</p>
          {opened.status === 'DRAFT' && (
            <Link className="cc-button" to={'/wizard?applicationId=' + id}>
              Продолжить черновик
            </Link>
          )}
          {opened.decision?.reasons.map((r) => (
            <p key={r.code}>{r.text}</p>
          ))}
          {opened.finalOffer && (
            <dl className="cc-facts">
              <dt>Сумма</dt>
              <dd>{formatRub(opened.finalOffer.amount)}</dd>
              <dt>Срок</dt>
              <dd>{opened.finalOffer.termMonths} мес.</dd>
              <dt>Ставка</dt>
              <dd>{opened.finalOffer.annualRatePercent}%</dd>
              <dt>Платёж</dt>
              <dd>{formatRub(opened.finalOffer.monthlyPayment)}</dd>
            </dl>
          )}
          {opened.decision?.changes.map((c) => (
            <p key={c.field}>
              {OFFER_FIELD_LABELS[c.field] || 'Условие'}: {c.requested} → {c.offered}
            </p>
          ))}
          {['APPROVED', 'COUNTER_OFFERED'].includes(opened.status) && (
            <div className="cc-actions">
              <button className="cc-button" disabled={busy} onClick={() => void act('accept')}>
                Принять условия — демо
              </button>
              <button
                className="cc-button secondary"
                disabled={busy}
                onClick={() => void act('decline')}
              >
                Отказаться от предложения
              </button>
            </div>
          )}
          {opened.status === 'CHECK_FAILED' && (
            <button className="cc-button" disabled={busy} onClick={() => void act('retry-check')}>
              Повторить проверку
            </button>
          )}
          {opened.status === 'NEEDS_CLARIFICATION' && (
            <div className="cc-form">
              <h3>Нужно дополнить</h3>
              {opened.openRequests.map((r, i) => (
                <p key={i}>{r.message}</p>
              ))}
              <Link to="/documents" target="_blank" rel="noreferrer">
                Загрузить документ
              </Link>
              <button
                className="cc-button secondary"
                onClick={() =>
                  getDocuments()
                    .then(setLibrary)
                    .catch((e) => setError(e.message))
                }
              >
                Обновить библиотеку
              </button>
              {library.map((d) => (
                <label key={d.id}>
                  <input
                    type="checkbox"
                    checked={attached.includes(d.id)}
                    onChange={() =>
                      setAttached((old) =>
                        old.includes(d.id) ? old.filter((x) => x !== d.id) : [...old, d.id],
                      )
                    }
                  />
                  {d.title}
                </label>
              ))}
              <button
                className="cc-button"
                disabled={busy}
                onClick={() =>
                  void act('clarification-response', { attachedDocumentIds: attached })
                }
              >
                Отправить дополнение
              </button>
            </div>
          )}
          <h3>История</h3>
          {opened.history.map((h, i) => (
            <p key={i}>
              <small>{new Date(h.at).toLocaleString('ru-RU')}</small> · {h.message}
            </p>
          ))}
        </section>
      )}
      {inquiries.length > 0 && (
        <section className="cc-card">
          <h2>Вопросы по цели</h2>
          {inquiries.map((q) => (
            <div key={q.id}>
              <p>
                {q.text} · {q.status === 'OPEN' ? 'Ожидает ответа' : 'Получен ответ'}
              </p>
              {q.employeeMessage && <p>{q.employeeMessage}</p>}
              {q.suggestedCategory && (
                <p>
                  Предложенная категория:{' '}
                  {GOAL_LABELS[q.suggestedCategory] || 'уточните у сотрудника'}. Выберите её в
                  подборе.
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
