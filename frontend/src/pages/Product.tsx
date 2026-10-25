import { useEffect, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Amount } from '@alfalab/core-components/amount';
import { Button } from '@alfalab/core-components/button';
import { Link } from '@alfalab/core-components/link';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { getProducts } from '../api/products';
import type { Product as ProductModel } from '../types';
import styles from './Product.module.css';

/** Данные, которые экран «Кредиты» передаёт через navigate. */
interface ProductLocationState {
  productId?: string;
  purpose?: string;
  amount?: number;
  months?: number;
}

const DEFAULTS = { amount: 750_000, months: 12, purpose: 'Развитие' };

const STEPS = ['Параметры', 'Компания', 'Документы', 'Проверка'];

const isEquipmentId = (id?: string) => id === 'equipment' || /equip|оборудован/i.test(id ?? '');

const positive = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;

export default function Product() {
  const navigate = useNavigate();
  const state = (useLocation().state as ProductLocationState | null) ?? {};

  const amount = positive(state.amount, DEFAULTS.amount);
  const months = positive(state.months, DEFAULTS.months);
  const purpose = state.purpose || DEFAULTS.purpose;

  const [catalogProduct, setCatalogProduct] = useState<ProductModel | null>(null);

  // 1. Скролл наверх при открытии страницы
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 2. Название и условия берём из каталога; если бэкенд недоступен — выводим по id.
  useEffect(() => {
    if (!state.productId) return;
    let cancelled = false;
    getProducts()
      .then((list) => {
        if (!cancelled) setCatalogProduct(list.find((p) => p.id === state.productId) ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [state.productId]);

  const equipment = catalogProduct
    ? /оборудован/i.test(catalogProduct.name) || isEquipmentId(catalogProduct.id)
    : isEquipmentId(state.productId);
  const name =
    catalogProduct?.name ?? (equipment ? 'Кредит на оборудование' : 'Кредит на развитие бизнеса');
  const description = equipment
    ? 'Для покупки нового или бывшего в использовании оборудования для действующего бизнеса.'
    : 'Для текущих и новых задач действующего бизнеса: оборот, реклама, ремонт, развитие.';

  const goBack = (e: MouseEvent) => {
    e.preventDefault();
    navigate('/credits');
  };

  return (
    <>
      <Link href="/credits" onClick={goBack} className={styles.back}>
        ← Назад к подбору
      </Link>

      <div className="page-head">
        {/* 3. Заменили красный/фиолетовый на спокойный серый */}
        <Tag view="filled" size={32} className="tag tag--gray">
          {equipment ? 'Оборудование' : 'Развитие бизнеса'}
        </Tag>
        <Typography.Title tag="h1" view="large" weight="bold" style={{ marginTop: 12 }}>
          {name}
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary" tag="div">
          {description} Сначала ознакомьтесь с условиями, затем начните заявку.
        </Typography.Text>
      </div>

      <section className={styles.params} aria-label="Выбранные параметры">
        <div className={styles.param}>
          <Typography.Text view="secondary-small" color="secondary" tag="div">
            Сумма
          </Typography.Text>
          <div className={styles.paramValue}>
            {/* Amount принимает сумму в минорных единицах (копейках) */}
            <Amount value={amount * 100} minority={100} currency="RUB" bold="full" />
          </div>
        </div>
        <div className={styles.param}>
          <Typography.Text view="secondary-small" color="secondary" tag="div">
            Срок
          </Typography.Text>
          <div className={styles.paramValue}>{months} мес.</div>
        </div>
        <div className={styles.param}>
          <Typography.Text view="secondary-small" color="secondary" tag="div">
            Цель
          </Typography.Text>
          <div className={`${styles.paramValue} ${styles.paramValueText}`}>{purpose}</div>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="flow-title">
          <Typography.Title tag="h2" view="small" weight="bold" id="flow-title">
            Как пойдёт оформление
          </Typography.Title>
          <ol className={styles.steps}>
            {STEPS.map((step, i) => (
              <li key={step}>
                <span className={styles.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <Typography.Text view="primary-small" color="secondary" tag="div">
            Цель «{purpose}» мы уже знаем — повторно в заявке её спрашивать не будем. Черновик
            сохраняется, к нему можно вернуться позже.
          </Typography.Text>
        </section>

        <section className={styles.card} aria-labelledby="docs-title">
          <Typography.Title tag="h2" view="small" weight="bold" id="docs-title">
            Документы
          </Typography.Title>
          <ul className={styles.docs}>
            <li>Финансовый документ — например, выписка за выбранный период</li>
            <li>Документ компании — сведения действующего ИП или ООО</li>
          </ul>
          <Typography.Text view="primary-small" color="secondary" tag="div">
            Их можно подготовить заранее или добавить прямо на шаге заявки. Документы сохраняются в
            общей библиотеке и подойдут для следующих заявок.
          </Typography.Text>
        </section>
      </div>

      <Typography.Text view="secondary-small" color="secondary" tag="div" style={{ marginBottom: 16 }}>
        Условия демонстрационные. Окончательное предложение банк назовёт после проверки заявки.
      </Typography.Text>

      <div className={styles.actions}>
        <Button view="accent" size={64} onClick={() => navigate('/wizard')}>
          Оформить заявку →
        </Button>
        <Button view="outlined" size={64} onClick={() => navigate('/credits')}>
          Изменить параметры
        </Button>
      </div>
    </>
  );
}