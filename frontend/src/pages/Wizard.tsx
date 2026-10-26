import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { applicationAction, getApplication, getChecks, updateDraft } from '../api/applications';
import { getDocuments, getGoals, getTariff, preview } from '../api/catalog';
import { ApiError } from '../api/client';
import { useApp } from '../context/AppContext';
import type {
  Application,
  DocumentCheck,
  DocumentRef,
  GoalInfo,
  LoanGoal,
  LoanOffer,
  Tariff,
} from '../types';
import { formatRub } from '../utils/format';
import { DOCUMENT_LABELS } from '../utils/documents';
const STEPS = ['Параметры', 'Компания', 'Документы', 'Проверка'];
export default function Wizard() {
  const [params] = useSearchParams();
  return <WizardForm key={params.get('applicationId') || 'new'} />;
}
function WizardForm() {
  const [params] = useSearchParams();
  const id = params.get('applicationId');
  const navigate = useNavigate();
  const { user, refreshApplications } = useApp();
  const [app, setApp] = useState<Application | null>(null);
  const [catalog, setCatalog] = useState<GoalInfo[]>([]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [checks, setChecks] = useState<DocumentCheck[]>([]);
  const [library, setLibrary] = useState<DocumentRef[]>([]);
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [goals, setGoals] = useState<LoanGoal[]>([]);
  const [consent, setConsent] = useState(false);
  const [selectedKind, setSelectedKind] = useState<LoanOffer['kind']>('REQUESTED');
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [attached, setAttached] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([getApplication(id), getGoals(), getTariff(), getDocuments(), getChecks(id)])
      .then(async ([a, g, t, d, c]) => {
        if (!active) return;
        setApp(a);
        setCatalog(g);
        setTariff(t);
        setLibrary(d);
        setChecks(c);
        setAmount(String(a.amount ?? ''));
        setTerm(String(a.termMonths ?? ''));
        setGoals(a.goals);
        setConsent(a.consent);
        setAttached(a.attachedDocumentIds);
        setStep(a.step);
        setSelectedKind(a.selectedKind);
        if (a.amount && a.termMonths) {
          const calculation = await preview({
            goals: a.goals,
            amount: a.amount,
            termMonths: a.termMonths,
          });
          if (active)
            setSelectedOffer(calculation.offers.find((o) => o.kind === a.selectedKind) || null);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const save = async (next = step) => {
    if (!id) return null;
    const a = await updateDraft(id, {
      goals,
      amount: amount === '' ? null : Number(amount),
      termMonths: term === '' ? null : Number(term),
      consent,
      selectedKind,
      attachedDocumentIds: attached,
      step: next,
    });
    setApp(a);
    setStep(a.step);
    setChecks(await getChecks(id));
    if (a.amount && a.termMonths) {
      const calculation = await preview({
        goals: a.goals,
        amount: a.amount,
        termMonths: a.termMonths,
      });
      const offer = calculation.offers.find((o) => o.kind === a.selectedKind);
      setSelectedOffer(offer || null);
      if (!offer)
        throw new Error(
          'Для этого срока выбранный расчёт недоступен. Выберите «По вашему запросу».',
        );
    }
    await refreshApplications();
    return a;
  };
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? [e.message, ...e.fieldErrors.map((f) => f.message)].join(' · ')
          : e instanceof Error
            ? e.message
            : 'Ошибка',
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await save();
      const sent = await applicationAction(id!, 'submit');
      await refreshApplications();
      navigate('/applications?applicationId=' + sent.id);
    });
  };
  if (!id)
    return (
      <section className="cc-card">
        <h1>Начните с подбора</h1>
        <Link to="/credits" className="cc-button">
          Выбрать параметры
        </Link>
      </section>
    );
  if (error && !app)
    return (
      <p role="alert" className="cc-error">
        {error}
      </p>
    );
  if (!app || !tariff) return <p>Загружаем черновик…</p>;
  if (app.status !== 'DRAFT')
    return (
      <section className="cc-card">
        <p>Заявка уже отправлена: {app.statusTitle}</p>
        <Link to={'/applications?applicationId=' + id}>Открыть заявку</Link>
      </section>
    );
  return (
    <>
      <div className="page-head">
        <h1>Заявка № {app.number}</h1>
        <p>
          Шаг {step} из 4 · {STEPS[step - 1]}
        </p>
      </div>
      <ol className="cc-steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i + 1 === step ? 'step' : undefined}>
            {s}
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="cc-error">
          {error}
        </p>
      )}
      <form className="cc-card cc-form" onSubmit={(e) => void submit(e)}>
        {step === 1 && (
          <>
            <h2>Параметры</h2>
            <div className="cc-goals">
              {catalog
                .filter((g) => g.code !== 'OTHER')
                .map((g) => (
                  <label key={g.code}>
                    <input
                      type="checkbox"
                      checked={goals.includes(g.code)}
                      onChange={() =>
                        setGoals((old) =>
                          old.includes(g.code) ? old.filter((x) => x !== g.code) : [...old, g.code],
                        )
                      }
                    />
                    {g.title}
                  </label>
                ))}
            </div>
            {goals.includes('OTHER') && (
              <p>
                Выберите конкретные категории.{' '}
                <button
                  type="button"
                  onClick={() => setGoals((old) => old.filter((g) => g !== 'OTHER'))}
                >
                  Убрать «Другое»
                </button>
              </p>
            )}
            <label>
              Сумма, ₽
              <input
                required
                type="number"
                step=".01"
                min={tariff.minAmount}
                max={tariff.maxAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Срок, месяцев
              <input
                required
                type="number"
                min={tariff.minTermMonths}
                max={tariff.maxTermMonths}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </label>
            <label>
              Выбранный расчёт
              <select
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value as LoanOffer['kind'])}
              >
                <option value="REQUESTED">По вашему запросу</option>
                <option value="LOWER_PAYMENT" disabled={Number(term) >= tariff.maxTermMonths}>
                  Меньше платёж в месяц
                </option>
              </select>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Данные компании</h2>
            <p>{user?.companyName}</p>
            <p>ИНН {user?.inn}</p>
            <p>{user?.fullName}</p>
            <p>Сведения из карточки клиента банка.</p>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Документы</h2>
            <p>
              <Link to="/documents" target="_blank" rel="noreferrer">
                Загрузить документ в библиотеку
              </Link>
              , затем{' '}
              <button
                type="button"
                className="cc-button secondary compact"
                onClick={() =>
                  void run(async () => {
                    setLibrary(await getDocuments());
                    setChecks(await getChecks(id));
                  })
                }
              >
                обновить список
              </button>
              .
            </p>
            {checks.map((c) => (
              <div className="cc-notice" key={c.type}>
                <strong>{DOCUMENT_LABELS[c.type] || c.type}</strong>
                <p>{c.reason}</p>
                <p>
                  {c.attached
                    ? 'Приложен: ' + c.attached.title
                    : c.suggested
                      ? 'Найден: ' + c.suggested.title
                      : c.blocksSubmit
                        ? 'Требуется до отправки'
                        : 'Можно предоставить после отправки'}
                </p>
              </div>
            ))}
            <button
              type="button"
              className="cc-button secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await save();
                  const a = await applicationAction(id, 'documents/attach-suggested');
                  setApp(a);
                  setAttached(a.attachedDocumentIds);
                  setChecks(await getChecks(id));
                })
              }
            >
              Приложить найденные документы
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
                {d.title} · версия {d.version}
              </label>
            ))}
          </>
        )}
        {step === 4 && (
          <>
            <h2>Проверьте заявку</h2>
            <p>
              {catalog
                .filter((g) => goals.includes(g.code))
                .map((g) => g.title)
                .join(', ')}
            </p>
            <p>
              {formatRub(Number(amount))} · {selectedOffer?.termMonths ?? term} месяцев
            </p>
            {selectedOffer && (
              <dl className="cc-facts">
                <dt>Ставка</dt>
                <dd>{selectedOffer.annualRatePercent}%</dd>
                <dt>Платёж в месяц</dt>
                <dd>{formatRub(selectedOffer.monthlyPayment)}</dd>
                <dt>Комиссия</dt>
                <dd>{formatRub(selectedOffer.upfrontFee)}</dd>
                <dt>Общая выплата</dt>
                <dd>{formatRub(selectedOffer.totalPayout)}</dd>
              </dl>
            )}
            <p>{user?.companyName}</p>
            <p>Документов: {attached.length}</p>
            <label>
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Я подтверждаю данные и согласен на обработку заявки
            </label>
          </>
        )}
        <div className="cc-actions">
          <button
            type="button"
            className="cc-button secondary"
            disabled={busy}
            onClick={() => void run(() => save())}
          >
            Сохранить черновик
          </button>
          {step > 1 && (
            <button
              type="button"
              className="cc-button secondary"
              disabled={busy}
              onClick={() => void run(() => save(step - 1))}
            >
              Назад
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              className="cc-button"
              disabled={busy}
              onClick={() => void run(() => save(step + 1))}
            >
              Далее
            </button>
          ) : (
            <button className="cc-button" disabled={busy || !consent || !selectedOffer}>
              Отправить заявку
            </button>
          )}
        </div>
      </form>
    </>
  );
}
