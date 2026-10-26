import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { SliderInput } from '@alfalab/core-components/slider-input';
import { Spinner } from '@alfalab/core-components/spinner';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { getGoals, getTariff, preview } from '../api/catalog';
import { createDraft, updateDraft } from '../api/applications';
import OtherGoalInput from '../components/ai/OtherGoalInput';
import type { GoalInfo, LoanGoal, LoanOffer, Selection, Tariff } from '../types';
import { formatMonths, formatRub } from '../utils/format';
import styles from './Credits.module.css';

const GOAL_ICONS: Record<LoanGoal, string> = {
  GOODS: '↗',
  ADVERTISING: '✦',
  EXPENSES: '◷',
  EQUIPMENT: '▣',
  REPAIR: '◈',
  OTHER: '＋',
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

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
  const offersRef = useRef<HTMLElement>(null);

  const [catalog, setCatalog] = useState<GoalInfo[]>([]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [goals, setGoals] = useState<LoanGoal[]>(incoming?.goals || []);
  const [text, setText] = useState(incoming?.purposeText || '');
  const [amount, setAmount] = useState<number | ''>(Number(incoming?.amount) || 1_000_000);
  const [term, setTerm] = useState<number | ''>(incoming?.termMonths || 24);
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

  /** Любое изменение параметров делает показанные расчёты устаревшими. */
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
        setTimeout(
          () => offersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          50,
        );
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
        <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
          Кредиты
        </Typography.Text>
        <Typography.Title tag="h1" view="large" weight="bold">
          Подобрать кредит
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary" tag="div">
          Одна общая сумма для выбранных целей. Просмотр расчётов не создаёт заявку.
        </Typography.Text>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {!tariff ? (
        <Spinner visible preset={24} />
      ) : (
        <form onSubmit={(e) => void calculate(e)} className={styles.layout}>
          <section className={styles.card} aria-labelledby="purpose-title">
            <Typography.Title tag="h2" view="small" weight="bold" id="purpose-title">
              На что нужны деньги?
            </Typography.Title>
            <div className={styles.purposes}>
              {catalog.map((g) => {
                const selected = goals.includes(g.code);
                return (
                  <label
                    key={g.code}
                    className={`${styles.purpose} ${selected ? styles.purposeSelected : ''}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.purposeInput}
                      checked={selected}
                      onChange={() => toggle(g.code)}
                    />
                    <span className={styles.purposeIcon} aria-hidden="true">
                      {GOAL_ICONS[g.code]}
                    </span>
                    <span className={styles.purposeName}>{g.title}</span>
                    <span className={styles.purposeHint}>{g.hint}</span>
                  </label>
                );
              })}
            </div>
            {goals.includes('OTHER') && (
              <div className={styles.otherBox}>
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
              </div>
            )}
            <Typography.Text
              view="secondary-small"
              color="secondary"
              tag="div"
              className={styles.hint}
            >
              Цель помогает объяснить подбор. Сама по себе она не меняет оценку компании.
            </Typography.Text>
          </section>

          <section className={styles.card} aria-labelledby="params-title">
            <Typography.Title tag="h2" view="small" weight="bold" id="params-title">
              Параметры
            </Typography.Title>
            <div className={styles.params}>
              <SliderInput
                label="Сумма, ₽"
                block
                size={64}
                min={tariff.minAmount}
                max={tariff.maxAmount}
                step={10_000}
                value={amount}
                sliderValue={clamp(
                  Number(amount) || tariff.minAmount,
                  tariff.minAmount,
                  tariff.maxAmount,
                )}
                onChange={(_, { value }) => {
                  invalidate();
                  setAmount(value);
                }}
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
                value={term}
                sliderValue={clamp(
                  Number(term) || tariff.minTermMonths,
                  tariff.minTermMonths,
                  tariff.maxTermMonths,
                )}
                onChange={(_, { value }) => {
                  invalidate();
                  setTerm(value);
                }}
                pips={{
                  mode: 'values',
                  values: [tariff.minTermMonths, tariff.maxTermMonths],
                  format: { to: (v: number) => formatMonths(v) },
                }}
              />
              <Typography.Text view="secondary-small" color="secondary" tag="div">
                Ставка {tariff.annualRatePercent}% годовых, разовая комиссия{' '}
                {tariff.upfrontFeePercent}%. Расчёт предварительный: решение принимается после
                рассмотрения заявки.
              </Typography.Text>
              <Button type="submit" view="accent" size={56} block loading={busy} disabled={busy}>
                Показать расчёты
              </Button>
            </div>
          </section>
        </form>
      )}

      {offers.length > 0 && (
        <section ref={offersRef} aria-labelledby="offers-title">
          <Typography.Title
            tag="h2"
            view="medium"
            weight="bold"
            id="offers-title"
            className={styles.sectionTitle}
          >
            Варианты для вас
          </Typography.Title>
          <div className={styles.products}>
            {offers.map((o) => (
              <article key={o.kind} className={`${styles.card} ${styles.product}`}>
                <Tag view="filled" size={32} className="tag tag--gray">
                  {o.kind === 'REQUESTED' ? 'Как вы запросили' : 'Дольше срок, меньше платёж'}
                </Tag>
                <Typography.Title tag="h3" view="small" weight="bold">
                  {o.kind === 'REQUESTED' ? 'По вашему запросу' : 'Меньше платёж в месяц'}
                </Typography.Title>
                <Typography.Text
                  view="primary-medium"
                  color="secondary"
                  tag="div"
                  className={styles.offerMeta}
                >
                  {formatRub(o.amount)} · {o.termMonths} мес.
                </Typography.Text>
                <div className={styles.productLimit}>{formatRub(o.monthlyPayment)} / мес.</div>
                <dl className={styles.conditions}>
                  <div>
                    <dt>Ставка</dt>
                    <dd>{o.annualRatePercent}%</dd>
                  </div>
                  <div>
                    <dt>Комиссия</dt>
                    <dd>{formatRub(o.upfrontFee)}</dd>
                  </div>
                  <div>
                    <dt>Проценты</dt>
                    <dd>{formatRub(o.totalInterest)}</dd>
                  </div>
                  <div>
                    <dt>Общая выплата с комиссией</dt>
                    <dd>{formatRub(o.totalPayout)}</dd>
                  </div>
                </dl>
                <Typography.Text view="secondary-small" color="secondary" tag="div">
                  Предварительный расчёт. Решение — после рассмотрения заявки.
                </Typography.Text>
                <Button
                  className={styles.productAction}
                  view={o.kind === 'REQUESTED' ? 'accent' : 'secondary'}
                  size={48}
                  disabled={busy}
                  onClick={() => void start(o)}
                >
                  Начать оформление
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
