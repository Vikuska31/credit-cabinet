import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getGoals, getTariff, preview } from '../api/catalog';
import { createDraft, updateDraft } from '../api/applications';
import OtherGoalInput from '../components/ai/OtherGoalInput';
import type { GoalInfo, LoanGoal, LoanOffer, Selection, Tariff } from '../types';
import { formatRub } from '../utils/format';
export default function Credits() {
  const location = useLocation();
  return <CreditsForm key={location.key} />;
}
function CreditsForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (
    location.state as {
      aiPrefill?: {
        goals: LoanGoal[];
        amount: string | null;
        termMonths: number | null;
        purposeText: string | null;
      };
    } | null
  )?.aiPrefill;
  const [catalog, setCatalog] = useState<GoalInfo[]>([]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [goals, setGoals] = useState<LoanGoal[]>(incoming?.goals || []);
  const [text, setText] = useState(incoming?.purposeText || '');
  const [amount, setAmount] = useState(incoming?.amount || '1000000');
  const [term, setTerm] = useState(String(incoming?.termMonths || 24));
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [snapshot, setSnapshot] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const starting = useRef(false);
  useEffect(() => {
    Promise.all([getGoals(), getTariff()])
      .then(([g, t]) => {
        setCatalog(g);
        setTariff(t);
      })
      .catch((e) => setError(e.message));
  }, []);
  const invalidate = () => {
    requestId.current++;
    setBusy(false);
    setOffers([]);
    setSnapshot(null);
    setError('');
  };
  const toggle = (g: LoanGoal) => {
    invalidate();
    setGoals((old) => (old.includes(g) ? old.filter((x) => x !== g) : [...old, g]));
  };
  const calculate = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const id = ++requestId.current;
    const s = { goals, otherGoalText: text, amount: Number(amount), termMonths: Number(term) };
    try {
      if (!goals.length || goals.includes('OTHER'))
        throw new Error(
          'Выберите конкретные категории или подтвердите результат анализа «Другое».',
        );
      const r = await preview(s);
      if (id === requestId.current) {
        setOffers(r.offers);
        setSnapshot(s);
      }
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : 'Ошибка расчёта');
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };
  const start = async (o: LoanOffer) => {
    if (!snapshot || starting.current) return;
    starting.current = true;
    setBusy(true);
    setError('');
    let id: string | undefined;
    try {
      const a = await createDraft();
      id = a.id;
      await updateDraft(a.id, { ...snapshot, selectedKind: o.kind, step: 1 });
      navigate('/wizard?applicationId=' + a.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
      if (id) navigate('/wizard?applicationId=' + id);
    } finally {
      starting.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-head">
        <h1>Подобрать кредит</h1>
        <p>Одна общая сумма для выбранных целей. Просмотр расчётов не создаёт заявку.</p>
      </div>
      {error && (
        <p role="alert" className="cc-error">
          {error}
        </p>
      )}
      {!tariff ? (
        <p>Загружаем условия…</p>
      ) : (
        <form onSubmit={(e) => void calculate(e)} className="cc-grid">
          <section className="cc-card">
            <h2>На что нужны деньги?</h2>
            <div className="cc-goals">
              {catalog.map((g) => (
                <label key={g.code} className={goals.includes(g.code) ? 'selected' : ''}>
                  <input
                    type="checkbox"
                    checked={goals.includes(g.code)}
                    onChange={() => toggle(g.code)}
                  />
                  {g.title}
                  <small>{g.hint}</small>
                </label>
              ))}
            </div>
            {goals.includes('OTHER') && (
              <OtherGoalInput
                text={text}
                catalog={catalog}
                onText={(v) => {
                  invalidate();
                  setText(v);
                }}
                onConfirm={(accepted) => {
                  invalidate();
                  setGoals((old) => [
                    ...new Set([...old.filter((g) => g !== 'OTHER'), ...accepted]),
                  ]);
                }}
              />
            )}
          </section>
          <section className="cc-card cc-form">
            <h2>Параметры</h2>
            <label>
              Сумма, ₽
              <input
                type="number"
                required
                min={tariff.minAmount}
                max={tariff.maxAmount}
                step="0.01"
                value={amount}
                onChange={(e) => {
                  invalidate();
                  setAmount(e.target.value);
                }}
              />
            </label>
            <small>
              {formatRub(tariff.minAmount)}–{formatRub(tariff.maxAmount)}
            </small>
            <label>
              Срок, месяцев
              <input
                type="number"
                required
                min={tariff.minTermMonths}
                max={tariff.maxTermMonths}
                value={term}
                onChange={(e) => {
                  invalidate();
                  setTerm(e.target.value);
                }}
              />
            </label>
            <button className="cc-button" disabled={busy}>
              Показать расчёты
            </button>
          </section>
        </form>
      )}
      <div className="cc-grid">
        {offers.map((o) => (
          <section className="cc-card" key={o.kind}>
            <h2>{o.kind === 'REQUESTED' ? 'По вашему запросу' : 'Меньше платёж в месяц'}</h2>
            <p>
              {formatRub(o.amount)} · {o.termMonths} мес.
            </p>
            <strong className="cc-amount">{formatRub(o.monthlyPayment)} / мес.</strong>
            <dl className="cc-facts">
              <dt>Ставка</dt>
              <dd>{o.annualRatePercent}%</dd>
              <dt>Комиссия</dt>
              <dd>{formatRub(o.upfrontFee)}</dd>
              <dt>Проценты</dt>
              <dd>{formatRub(o.totalInterest)}</dd>
              <dt>Общая выплата с комиссией</dt>
              <dd>{formatRub(o.totalPayout)}</dd>
            </dl>
            <p>Предварительный расчёт. Решение — после рассмотрения заявки.</p>
            <button className="cc-button" disabled={busy} onClick={() => void start(o)}>
              Начать оформление
            </button>
          </section>
        ))}
      </div>
    </>
  );
}
