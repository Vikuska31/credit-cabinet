import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { Checkbox } from '@alfalab/core-components/checkbox';
import { Input } from '@alfalab/core-components/input';
import { ProgressBar } from '@alfalab/core-components/progress-bar';
import { SliderInput } from '@alfalab/core-components/slider-input';
import { Spinner } from '@alfalab/core-components/spinner';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
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
import { formatMonths, formatRub } from '../utils/format';
import { DOCUMENT_LABELS } from '../utils/documents';
import styles from './Wizard.module.css';

const STEPS = ['Параметры', 'Компания', 'Документы', 'Проверка'];
const notSpecified = 'Не указано';

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
      <section className={styles.card}>
        <Typography.Title tag="h1" view="small" weight="bold">
          Начните с подбора
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary" tag="div">
          Заявка создаётся после выбора расчёта на странице «Кредиты».
        </Typography.Text>
        <p>
          <Link to="/credits">
            <Button view="accent" size={48}>
              Выбрать параметры
            </Button>
          </Link>
        </p>
      </section>
    );
  if (error && !app)
    return (
      <p role="alert" className={styles.error}>
        {error}
      </p>
    );
  if (!app || !tariff) return <Spinner visible preset={24} />;
  if (app.status !== 'DRAFT')
    return (
      <section className={styles.card}>
        <Typography.Text view="primary-medium" tag="div">
          Заявка уже отправлена: {app.statusTitle}
        </Typography.Text>
        <p>
          <Link to={'/applications?applicationId=' + id}>Открыть заявку</Link>
        </p>
      </section>
    );

  const progress = Math.round((step / STEPS.length) * 100);
  const goalTitles = catalog
    .filter((g) => goals.includes(g.code))
    .map((g) => g.title)
    .join(', ');
  const amountNumber = amount === '' ? '' : Number(amount);
  const termNumber = term === '' ? '' : Number(term);

  return (
    <>
      <div className="page-head">
        <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
          Заявка
        </Typography.Text>
        <Typography.Title tag="h1" view="large" weight="bold">
          Заявка № {app.number}
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary" tag="div">
          Шаг {step} из {STEPS.length} · {STEPS[step - 1]}. Проверьте данные перед отправкой.
        </Typography.Text>
      </div>

      <ol className={styles.stepper} aria-label="Шаги заявки">
        {STEPS.map((title, i) => (
          <li
            key={title}
            aria-current={i + 1 === step ? 'step' : undefined}
            className={`${styles.step} ${i + 1 === step ? styles.stepCurrent : ''} ${i + 1 < step ? styles.stepDone : ''}`}
          >
            <span className={styles.stepNum} aria-hidden="true">
              {i + 1 < step ? '✓' : i + 1}
            </span>
            {title}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.layout}>
        <form
          className={styles.card}
          onSubmit={(e) => void submit(e)}
          aria-labelledby="wizard-step-title"
        >
          {step === 1 && (
            <>
              <Typography.Title tag="h2" view="small" weight="bold" id="wizard-step-title">
                Параметры
              </Typography.Title>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Цели и расчёт выбраны при подборе. Здесь их можно уточнить.
              </Typography.Text>
              <div className={styles.body}>
                <div className={styles.goals}>
                  {catalog
                    .filter((g) => g.code !== 'OTHER')
                    .map((g) => (
                      <Checkbox
                        key={g.code}
                        block
                        size={24}
                        label={g.title}
                        checked={goals.includes(g.code)}
                        onChange={(_, { checked }) =>
                          setGoals((old) =>
                            checked ? [...old, g.code] : old.filter((x) => x !== g.code),
                          )
                        }
                      />
                    ))}
                </div>
                {goals.includes('OTHER') && (
                  <Typography.Text view="primary-small" tag="div">
                    Выберите конкретные категории.{' '}
                    <Button
                      type="button"
                      view="text"
                      size={32}
                      onClick={() => setGoals((old) => old.filter((g) => g !== 'OTHER'))}
                    >
                      Убрать «Другое»
                    </Button>
                  </Typography.Text>
                )}
                <SliderInput
                  label="Сумма, ₽"
                  block
                  size={64}
                  min={tariff.minAmount}
                  max={tariff.maxAmount}
                  step={10_000}
                  value={amountNumber}
                  sliderValue={Math.min(
                    tariff.maxAmount,
                    Math.max(tariff.minAmount, Number(amount) || tariff.minAmount),
                  )}
                  onChange={(_, { value }) => setAmount(value === '' ? '' : String(value))}
                  pips={{
                    mode: 'values',
                    values: [tariff.minAmount, tariff.maxAmount],
                    format: { to: (v: number) => formatRub(v) },
                  }}
                />
                <SliderInput
                  label="Срок, месяцев"
                  block
                  size={64}
                  min={tariff.minTermMonths}
                  max={tariff.maxTermMonths}
                  step={1}
                  value={termNumber}
                  sliderValue={Math.min(
                    tariff.maxTermMonths,
                    Math.max(tariff.minTermMonths, Number(term) || tariff.minTermMonths),
                  )}
                  onChange={(_, { value }) => setTerm(value === '' ? '' : String(value))}
                  pips={{
                    mode: 'values',
                    values: [tariff.minTermMonths, tariff.maxTermMonths],
                    format: { to: (v: number) => formatMonths(v) },
                  }}
                />
                <label className={styles.fieldLabel}>
                  Выбранный расчёт
                  <select
                    className={styles.select}
                    value={selectedKind}
                    onChange={(e) => setSelectedKind(e.target.value as LoanOffer['kind'])}
                  >
                    <option value="REQUESTED">По вашему запросу</option>
                    <option value="LOWER_PAYMENT" disabled={Number(term) >= tariff.maxTermMonths}>
                      Меньше платёж в месяц
                    </option>
                  </select>
                </label>
                <Typography.Text
                  view="primary-small"
                  color="secondary"
                  tag="div"
                  className={styles.note}
                >
                  Это запрос клиента. Банк может предложить другие условия после проверки.
                </Typography.Text>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Typography.Title tag="h2" view="small" weight="bold" id="wizard-step-title">
                Данные компании
              </Typography.Title>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Сведения из карточки клиента банка. Проверьте, что вы используете нужный аккаунт.
              </Typography.Text>
              <div className={styles.body}>
                <Input
                  label="Компания"
                  block
                  size={56}
                  readOnly
                  value={user?.companyName ?? notSpecified}
                />
                <div className={styles.fieldsRow}>
                  <Input label="ИНН" block size={56} readOnly value={user?.inn ?? notSpecified} />
                  <Input
                    label="ФИО"
                    block
                    size={56}
                    readOnly
                    value={user?.fullName ?? notSpecified}
                  />
                </div>
                <Typography.Text
                  view="primary-small"
                  color="secondary"
                  tag="div"
                  className={styles.note}
                >
                  Изменить данные компании в заявке нельзя. Если они устарели, обратитесь в банк.
                </Typography.Text>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Typography.Title tag="h2" view="small" weight="bold" id="wizard-step-title">
                Документы
              </Typography.Title>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                <Link to="/documents" target="_blank" rel="noreferrer">
                  Загрузить документ в библиотеку
                </Link>
                , затем{' '}
                <Button
                  type="button"
                  view="text"
                  size={32}
                  onClick={() =>
                    void run(async () => {
                      setLibrary(await getDocuments());
                      setChecks(await getChecks(id));
                    })
                  }
                >
                  обновить список
                </Button>
              </Typography.Text>
              <div className={styles.body}>
                <ul className={styles.docs}>
                  {checks.map((c) => (
                    <li className={styles.doc} key={c.type}>
                      <div className={styles.docHead}>
                        <Typography.Text view="primary-medium" weight="bold">
                          {DOCUMENT_LABELS[c.type] || c.type}
                        </Typography.Text>
                        <Tag
                          view="filled"
                          size={32}
                          className={`tag tag--${c.attached ? 'green' : c.suggested ? 'blue' : c.blocksSubmit ? 'red' : 'gray'}`}
                        >
                          {c.attached
                            ? 'Приложен'
                            : c.suggested
                              ? 'Найден в библиотеке'
                              : c.blocksSubmit
                                ? 'Нужен до отправки'
                                : 'Можно после отправки'}
                        </Tag>
                      </div>
                      <p className={styles.docReason}>{c.reason}</p>
                      <Typography.Text view="primary-small" tag="div">
                        {c.attached
                          ? 'Приложен: ' + c.attached.title
                          : c.suggested
                            ? 'Найден: ' + c.suggested.title
                            : c.blocksSubmit
                              ? 'Требуется до отправки'
                              : 'Можно предоставить после отправки'}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  view="secondary"
                  size={48}
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
                </Button>
                {library.length > 0 && (
                  <div className={styles.library}>
                    <Typography.Text view="secondary-small" color="secondary" tag="div">
                      Библиотека компании
                    </Typography.Text>
                    {library.map((d) => (
                      <Checkbox
                        key={d.id}
                        block
                        size={24}
                        label={`${d.title} · версия ${d.version}`}
                        checked={attached.includes(d.id)}
                        onChange={(_, { checked }) =>
                          setAttached((old) =>
                            checked ? [...old, d.id] : old.filter((x) => x !== d.id),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <Typography.Title tag="h2" view="small" weight="bold" id="wizard-step-title">
                Проверка и отправка
              </Typography.Title>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Проверьте данные. После отправки появится номер и статус заявки.
              </Typography.Text>
              <div className={styles.body}>
                <dl className={styles.summary}>
                  <div>
                    <dt>Цели</dt>
                    <dd>{goalTitles || notSpecified}</dd>
                  </div>
                  <div>
                    <dt>Сумма</dt>
                    <dd>{formatRub(Number(amount))}</dd>
                  </div>
                  <div>
                    <dt>Срок</dt>
                    <dd>{selectedOffer?.termMonths ?? term} месяцев</dd>
                  </div>
                  {selectedOffer && (
                    <>
                      <div>
                        <dt>Ставка</dt>
                        <dd>{selectedOffer.annualRatePercent}%</dd>
                      </div>
                      <div>
                        <dt>Платёж в месяц</dt>
                        <dd>{formatRub(selectedOffer.monthlyPayment)}</dd>
                      </div>
                      <div>
                        <dt>Комиссия</dt>
                        <dd>{formatRub(selectedOffer.upfrontFee)}</dd>
                      </div>
                      <div>
                        <dt>Общая выплата</dt>
                        <dd>{formatRub(selectedOffer.totalPayout)}</dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>Компания</dt>
                    <dd>{user?.companyName ?? notSpecified}</dd>
                  </div>
                  <div>
                    <dt>Документов</dt>
                    <dd>{attached.length}</dd>
                  </div>
                </dl>
                <Checkbox
                  block
                  size={24}
                  checked={consent}
                  label="Я подтверждаю данные и согласен на обработку заявки"
                  onChange={(_, { checked }) => setConsent(checked)}
                />
              </div>
            </>
          )}

          <div className={styles.actions}>
            {step > 1 && (
              <Button
                type="button"
                view="outlined"
                size={48}
                disabled={busy}
                onClick={() => void run(() => save(step - 1))}
              >
                Назад
              </Button>
            )}
            <Button
              type="button"
              view="secondary"
              size={48}
              disabled={busy}
              onClick={() => void run(() => save())}
            >
              Сохранить черновик
            </Button>
            <span className={styles.spacer} />
            {step < STEPS.length ? (
              <Button
                type="button"
                view="accent"
                size={48}
                disabled={busy}
                onClick={() => void run(() => save(step + 1))}
              >
                Далее
              </Button>
            ) : (
              <Button
                type="submit"
                view="accent"
                size={48}
                loading={busy}
                disabled={busy || !consent || !selectedOffer}
              >
                Отправить заявку
              </Button>
            )}
          </div>
        </form>

        <aside className={styles.aside} aria-label="Сводка заявки">
          <div className={styles.card}>
            <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
              Ваша заявка
            </Typography.Text>
            <Typography.Title tag="h2" view="small" weight="bold" className={styles.asideProduct}>
              № {app.number}
            </Typography.Title>
            <dl className={styles.asideFacts}>
              <div>
                <dt>Сумма</dt>
                <dd>{amount ? formatRub(Number(amount)) : notSpecified}</dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>{term ? formatMonths(Number(term)) : notSpecified}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>
                  <Tag view="filled" size={32} className="tag tag--purple">
                    Черновик
                  </Tag>
                </dd>
              </div>
            </dl>
            <div className={styles.progressLabel}>
              <Typography.Text view="secondary-small" color="secondary">
                Заполнение
              </Typography.Text>
              <Typography.Text view="secondary-small" weight="bold">
                {progress}%
              </Typography.Text>
            </div>
            <ProgressBar
              value={progress}
              view="accent"
              size={8}
              aria-label="Прогресс заполнения заявки"
            />
          </div>
        </aside>
      </div>
    </>
  );
}
