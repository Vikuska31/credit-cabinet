import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { Notification } from '@alfalab/core-components/notification';
import { SliderInput } from '@alfalab/core-components/slider-input';
import { Spinner } from '@alfalab/core-components/spinner';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { getProducts } from '../api/products';
import type { Product } from '../types';
import { formatMonths, formatRub } from '../utils/format';
import styles from './Credits.module.css';

const PURPOSES = [
  { name: 'Оборотные средства', icon: '↗' },
  { name: 'Оборудование', icon: '▣' },
  { name: 'Реклама', icon: '✦' },
  { name: 'Развитие', icon: '◈' },
  { name: 'Кассовый разрыв', icon: '◷' },
  { name: 'Другая цель', icon: '＋' },
] as const;

const AMOUNT = { min: 100_000, max: 3_000_000, step: 10_000, initial: 750_000 };
const MONTHS = { min: 6, max: 36, step: 1, initial: 12 };

/** Запасной каталог, если бэкенд недоступен. */
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'business',
    name: 'Кредит на развитие бизнеса',
    description: 'Для пополнения оборотных средств, рекламы, ремонта и других задач развития.',
    minAmount: 100_000,
    maxAmount: 2_000_000,
    minMonths: 6,
    maxMonths: 36,
    rate: 18.9,
  },
  {
    id: 'equipment',
    name: 'Кредит на оборудование',
    description: 'Для покупки нового или бывшего в использовании оборудования действующим бизнесом.',
    minAmount: 300_000,
    maxAmount: 3_000_000,
    minMonths: 12,
    maxMonths: 36,
    rate: 17.5,
  },
];

const isEquipment = (p: Product) => p.id === 'equipment' || /оборудован/i.test(p.name);

/** Аннуитетный платёж: сумма, срок в месяцах, годовая ставка в %. */
function calculate(amount: number, months: number, annualRate: number) {
  const r = annualRate / 100 / 12;
  const monthly = r === 0 ? amount / months : (amount * r) / (1 - Math.pow(1 + r, -months));
  const total = monthly * months;
  return { monthly, total, interest: total - amount };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function Credits() {
  const navigate = useNavigate();
  const productsRef = useRef<HTMLElement>(null);

  const [purpose, setPurpose] = useState<string>(PURPOSES[0].name);
  const [amountInput, setAmountInput] = useState<number | ''>(AMOUNT.initial);
  const [monthsInput, setMonthsInput] = useState<number | ''>(MONTHS.initial);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProducts()
      .then((list) => {
        if (cancelled) return;
        if (list.length) setProducts(list);
        else {
          setProducts(MOCK_PRODUCTS);
          setUsingMock(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProducts(MOCK_PRODUCTS); // бэкенд недоступен — показываем моки
        setUsingMock(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Пока пользователь печатает в поле, там может быть пусто — считаем по границам.
  const amount = clamp(Number(amountInput) || AMOUNT.min, AMOUNT.min, AMOUNT.max);
  const months = clamp(Number(monthsInput) || MONTHS.min, MONTHS.min, MONTHS.max);

  // Для цели «Оборудование» считаем по ставке продукта на оборудование, иначе — по «развитию».
  const baseProduct = useMemo(() => {
    const wantEquipment = purpose === 'Оборудование';
    return products.find((p) => isEquipment(p) === wantEquipment) ?? products[0];
  }, [products, purpose]);

  const calc = useMemo(
    () => (baseProduct ? calculate(amount, months, baseProduct.rate) : null),
    [amount, months, baseProduct],
  );

  const sorted = useMemo(
    () => [...products].sort((a, b) => Number(isEquipment(a)) - Number(isEquipment(b))),
    [products],
  );

  const showOptions = () => {
    setHighlight(true);
    productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openProduct = (product: Product) =>
    navigate('/product', { state: { productId: product.id, purpose, amount, months } });

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
          Выберите цель и параметры. Изучение условий не создаёт заявку.
        </Typography.Text>
      </div>

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="purpose-title">
          <Typography.Title tag="h2" view="small" weight="bold" id="purpose-title">
            Для чего нужны деньги?
          </Typography.Title>
          <div className={styles.purposes} role="group" aria-labelledby="purpose-title">
            {PURPOSES.map(({ name, icon }) => {
              const selected = purpose === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  className={`${styles.purpose} ${selected ? styles.purposeSelected : ''}`}
                  onClick={() => setPurpose(name)}
                >
                  <span className={styles.purposeIcon} aria-hidden="true">
                    {icon}
                  </span>
                  <span className={styles.purposeName}>{name}</span>
                </button>
              );
            })}
          </div>
          <Typography.Text view="secondary-small" color="secondary" tag="div" className={styles.hint}>
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
              min={AMOUNT.min}
              max={AMOUNT.max}
              step={AMOUNT.step}
              value={amountInput}
              sliderValue={amount}
              onChange={(_, { value }) => setAmountInput(value)}
              onBlur={() => setAmountInput(amount)}
              pips={{
                mode: 'values',
                values: [AMOUNT.min, AMOUNT.max],
                format: { to: (v: number) => formatRub(v) },
              }}
            />

            <SliderInput
              label="Срок, месяцев"
              block
              size={64}
              min={MONTHS.min}
              max={MONTHS.max}
              step={MONTHS.step}
              value={monthsInput}
              sliderValue={months}
              onChange={(_, { value }) => setMonthsInput(value)}
              onBlur={() => setMonthsInput(months)}
              pips={{
                mode: 'values',
                values: [MONTHS.min, MONTHS.max],
                format: { to: (v: number) => formatMonths(v) },
              }}
            />

            <div className={styles.result} aria-live="polite">
              <div className={styles.resultMain}>
                <Typography.Text view="secondary-small" color="secondary" tag="div">
                  Ежемесячный платёж
                </Typography.Text>
                <div className={styles.resultMainValue}>{calc ? formatRub(calc.monthly) : '—'}</div>
              </div>
              <div className={styles.resultRow}>
                <Typography.Text view="primary-small" color="secondary">
                  Проценты за весь срок
                </Typography.Text>
                <b>{calc ? formatRub(calc.interest) : '—'}</b>
              </div>
              <div className={styles.resultRow}>
                <Typography.Text view="primary-small" color="secondary">
                  Общая выплата
                </Typography.Text>
                <b>{calc ? formatRub(calc.total) : '—'}</b>
              </div>
              <Typography.Text view="secondary-small" color="secondary" tag="div">
                Расчёт ориентировочный{baseProduct ? `, ставка ${baseProduct.rate}% годовых` : ''}.
                Итоговые условия банк назовёт после проверки заявки.
              </Typography.Text>
            </div>

            <Button view="accent" size={56} block onClick={showOptions} disabled={loading}>
              Показать варианты
            </Button>
          </div>
        </section>
      </div>

      <section ref={productsRef} aria-labelledby="products-title">
        <Typography.Title tag="h2" view="medium" weight="bold" id="products-title" className={styles.sectionTitle}>
          Варианты для вас
        </Typography.Title>

        {loading ? (
          <Spinner visible preset={24} />
        ) : (
          <div className={styles.products}>
            {sorted.map((product) => {
              const equipment = isEquipment(product);
              const fits = amount >= product.minAmount && amount <= product.maxAmount;
              const recommended = highlight && fits && equipment === (purpose === 'Оборудование');
              return (
                <article
                  key={product.id}
                  className={`${styles.card} ${styles.product} ${recommended ? styles.productRecommended : ''}`}
                >
                  <Tag view="filled" size={32} className="tag tag--gray">
                    {equipment ? 'Для оборудования' : 'Для разных бизнес-целей'}
                  </Tag>
                  <Typography.Title tag="h3" view="small" weight="bold">
                    {product.name}
                  </Typography.Title>
                  <Typography.Text view="primary-medium" color="secondary" tag="div">
                    {product.description}
                  </Typography.Text>
                  <div className={styles.productLimit}>До {formatRub(product.maxAmount)}</div>
                  <dl className={styles.conditions}>
                    <div>
                      <dt>Сумма</dt>
                      <dd>
                        {formatRub(product.minAmount)} – {formatRub(product.maxAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt>Срок</dt>
                      <dd>
                        {product.minMonths}–{product.maxMonths} мес.
                      </dd>
                    </div>
                    <div>
                      <dt>Ставка</dt>
                      <dd>от {product.rate}% годовых</dd>
                    </div>
                  </dl>
                  {highlight && !fits && (
                    <Typography.Text view="secondary-small" tag="div" className={styles.warn}>
                      Выбранная сумма вне лимитов продукта
                    </Typography.Text>
                  )}
                  <Button
                    className={styles.productAction}
                    view={recommended ? 'accent' : 'secondary'}
                    size={48}
                    onClick={() => openProduct(product)}
                  >
                    Подробнее →
                  </Button>
                </article>
              );
            })}
          </div>
        )}
        <Typography.Text view="secondary-small" color="secondary" tag="div" className={styles.hint}>
          Условия демонстрационные. Предложение зависит от проверки. Заявка начнётся только на странице
          выбранного кредита.
        </Typography.Text>
      </section>

      <Notification
        badge="attention-alert"
        title="Каталог недоступен"
        visible={usingMock}
        autoCloseDelay={6000}
        offset={88}
        hasCloser
        onClose={() => setUsingMock(false)}
        onCloseTimeout={() => setUsingMock(false)}
      >
        Показываем примерные продукты. Попробуйте обновить страницу позже.
      </Notification>
    </>
  );
}