import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { Checkbox } from '@alfalab/core-components/checkbox';
import { Modal } from '@alfalab/core-components/modal';
import { Segment, SegmentedControl } from '@alfalab/core-components/segmented-control';
import { Spinner } from '@alfalab/core-components/spinner';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { applicationAction, getApplication } from '../api/applications';
import { fetchApi } from '../api/client';
import { getDocuments } from '../api/catalog';
import { useApp } from '../context/AppContext';
import type { Application, ApplicationStatus, DocumentRef } from '../types';
import { APPLICATION_STATUS_LABELS } from '../types';
import { formatMonths, formatRub } from '../utils/format';
import { GOAL_LABELS, OFFER_FIELD_LABELS } from '../utils/goals';
import { STATUS_TONE, isFinalStatus } from '../utils/status';
import styles from './Applications.module.css';

interface Inquiry {
  id: string;
  text: string;
  status: string;
  suggestedCategory: string | null;
  employeeMessage: string | null;
}

type Filter = 'all' | 'active' | 'done';

const NOW_TEXT: Record<ApplicationStatus, string> = {
  DRAFT: 'Заявка ещё не отправлена. Продолжите оформление с того же шага.',
  UNDER_REVIEW: 'Заявка отправлена. Банк проверяет данные.',
  NEEDS_CLARIFICATION: 'Нужны дополнительные сведения или новый документ.',
  CHECK_FAILED:
    'Проверка не завершилась из-за технического сбоя. Её можно повторить — это не отказ.',
  APPROVED: 'Предложение готово. Проверьте условия и подтвердите.',
  COUNTER_OFFERED: 'Банк предложил другие условия. Сравните их с вашим запросом.',
  REJECTED: 'Банк отказал по этой заявке. Можно посмотреть другие варианты.',
  DECLINED_BY_CLIENT: 'Вы отказались от предложенных условий.',
  ISSUED: 'Оформление завершено (демонстрация, реальные деньги не переводятся).',
};

const STAGES = [
  'Заявка отправлена',
  'Проверка',
  'Решение или уточнение',
  'Принятие и выдача',
] as const;
type StageState = 'done' | 'current' | 'todo';

/** Состояние каждого из четырёх этапов для данного статуса. */
function getStages(status: ApplicationStatus): StageState[] {
  switch (status) {
    case 'DRAFT':
      return ['todo', 'todo', 'todo', 'todo'];
    case 'UNDER_REVIEW':
      return ['done', 'current', 'todo', 'todo'];
    case 'ISSUED':
      return ['done', 'done', 'done', 'done'];
    default:
      return ['done', 'done', 'current', 'todo'];
  }
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
function formatDate(value?: string | null): string {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? '—' : dateFormat.format(time);
}
const createdTime = (a: Application) => Date.parse(a.createdAt ?? '') || 0;

function StatusTag({ status }: { status: ApplicationStatus }) {
  return (
    <Tag view="filled" size={32} className={`tag tag--${STATUS_TONE[status]}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </Tag>
  );
}

const monthsOf = (a: Application) => a.months ?? a.termMonths;

export default function Applications() {
  const navigate = useNavigate();
  const { applications, applicationsStatus, applicationsError, refreshApplications } = useApp();
  const [params, setParams] = useSearchParams();
  const id = params.get('applicationId');
  const [filter, setFilter] = useState<Filter>('all');
  const [opened, setOpened] = useState<Application | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<DocumentRef[]>([]);
  const [attached, setAttached] = useState<string[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  const loading = applicationsStatus === 'idle' || applicationsStatus === 'loading';

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

  const close = () => {
    setOpened(null);
    setError('');
    setParams({});
  };

  const sorted = useMemo(
    () => [...applications].sort((a, b) => createdTime(b) - createdTime(a) || b.number - a.number),
    [applications],
  );
  const counts = useMemo(
    () => ({
      all: sorted.length,
      active: sorted.filter((a) => !isFinalStatus(a.status)).length,
      done: sorted.filter((a) => isFinalStatus(a.status)).length,
    }),
    [sorted],
  );
  const visible = useMemo(
    () =>
      sorted.filter((a) =>
        filter === 'all'
          ? true
          : filter === 'active'
            ? !isFinalStatus(a.status)
            : isFinalStatus(a.status),
      ),
    [sorted, filter],
  );

  const stages = opened ? getStages(opened.status) : [];

  return (
    <>
      <div className="page-head">
        <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
          Заявки
        </Typography.Text>
        <Typography.Title tag="h1" view="large" weight="bold">
          Мои заявки
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary" tag="div">
          Здесь показаны фактический этап, история и следующее действие.
        </Typography.Text>
      </div>

      {(error || applicationsError) && !opened && (
        <p role="alert" className={styles.error}>
          {error || applicationsError}
        </p>
      )}

      {loading && (
        <div className={styles.loader}>
          <Spinner visible preset={24} />
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">
            ▤
          </div>
          <Typography.Title tag="h2" view="small" weight="bold">
            Заявок пока нет
          </Typography.Title>
          <Typography.Text
            view="primary-medium"
            color="secondary"
            tag="div"
            className={styles.emptyText}
          >
            Подбор кредита доступен без оформления. Заявка появится здесь, как только вы её начнёте.
          </Typography.Text>
          <Button view="accent" size={48} onClick={() => navigate('/credits')}>
            Подобрать кредит
          </Button>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <SegmentedControl
              size={40}
              className={styles.filter}
              selectedId={filter}
              onChange={(next) => setFilter(next as Filter)}
            >
              <Segment id="all" title={`Все · ${counts.all}`} />
              <Segment id="active" title={`В работе · ${counts.active}`} />
              <Segment id="done" title={`Завершённые · ${counts.done}`} />
            </SegmentedControl>
            <Button view="secondary" size={40} onClick={() => navigate('/credits')}>
              Новая заявка
            </Button>
          </div>

          {visible.length === 0 ? (
            <div className={styles.empty}>
              <Typography.Text view="primary-medium" color="secondary" tag="div">
                В этой категории заявок нет.
              </Typography.Text>
              <Button view="secondary" size={40} onClick={() => setFilter('all')}>
                Показать все
              </Button>
            </div>
          ) : (
            <ul className={styles.list} style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {visible.map((app) => (
                <li key={app.id}>
                  <article className={styles.card}>
                    <div className={styles.cardMain}>
                      <StatusTag status={app.status} />
                      <div className={styles.cardTitle}>Заявка № {app.number}</div>
                      <Typography.Text view="secondary-small" color="secondary">
                        {app.purpose || app.product || 'Кредит для бизнеса'}
                      </Typography.Text>
                    </div>
                    <dl className={`${styles.fact} ${styles.facts}`}>
                      <dt>Сумма и срок</dt>
                      <dd>
                        {app.amount == null ? 'Сумма не указана' : formatRub(app.amount)} ·{' '}
                        {monthsOf(app) == null ? '—' : formatMonths(monthsOf(app) as number)}
                      </dd>
                    </dl>
                    <dl className={`${styles.fact} ${styles.facts}`}>
                      <dt>Создана</dt>
                      <dd>{formatDate(app.createdAt)}</dd>
                    </dl>
                    <Button
                      view="secondary"
                      size={40}
                      onClick={() => {
                        setError('');
                        setOpened(null);
                        setParams({ applicationId: app.id });
                      }}
                    >
                      Подробнее →
                    </Button>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {inquiries.length > 0 && (
        <section className={styles.inquiries}>
          <Typography.Title tag="h2" view="small" weight="bold">
            Вопросы по цели
          </Typography.Title>
          {inquiries.map((q) => (
            <div key={q.id} className={styles.block}>
              <Typography.Text view="primary-medium" tag="div">
                {q.text} · {q.status === 'OPEN' ? 'Ожидает ответа' : 'Получен ответ'}
              </Typography.Text>
              {q.employeeMessage && (
                <Typography.Text view="primary-small" color="secondary" tag="div">
                  {q.employeeMessage}
                </Typography.Text>
              )}
              {q.suggestedCategory && (
                <Typography.Text view="primary-small" color="secondary" tag="div">
                  Предложенная категория:{' '}
                  {GOAL_LABELS[q.suggestedCategory] || 'уточните у сотрудника'}. Выберите её в
                  подборе.
                </Typography.Text>
              )}
            </div>
          ))}
        </section>
      )}

      {id && opened?.id === id && (
        <Modal open onClose={close} size={600}>
          <Modal.Header hasCloser title={`Заявка № ${opened.number}`} />
          <Modal.Content>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div className={styles.detailHead}>
              <StatusTag status={opened.status} />
              <Typography.Text view="primary-large" weight="bold" tag="div">
                {opened.purpose || opened.product || 'Кредит для бизнеса'}
              </Typography.Text>
            </div>

            <dl className={styles.detailFacts}>
              <div>
                <dt>Сумма</dt>
                <dd>{opened.amount == null ? '—' : formatRub(opened.amount)}</dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>{monthsOf(opened) == null ? '—' : formatMonths(monthsOf(opened) as number)}</dd>
              </div>
              <div>
                <dt>Создана</dt>
                <dd>{formatDate(opened.createdAt)}</dd>
              </div>
            </dl>

            <Typography.Title tag="h3" view="xsmall" weight="bold" style={{ marginBottom: 12 }}>
              Этапы проверки
            </Typography.Title>
            <ol className={styles.stepper}>
              {STAGES.map((title, i) => (
                <li
                  key={title}
                  aria-current={stages[i] === 'current' ? 'step' : undefined}
                  className={`${styles.stage} ${
                    stages[i] === 'done'
                      ? styles.stageDone
                      : stages[i] === 'current'
                        ? styles.stageCurrent
                        : styles.stageTodo
                  }`}
                >
                  <span className={styles.stageDot} aria-hidden="true">
                    {stages[i] === 'done' ? '✓' : i + 1}
                  </span>
                  <span className={styles.stageTitle}>{title}</span>
                </li>
              ))}
            </ol>

            <div className={styles.now}>
              <Typography.Text view="secondary-small" color="secondary" tag="div">
                Что происходит сейчас
              </Typography.Text>
              <Typography.Text view="primary-medium" tag="div">
                {NOW_TEXT[opened.status]}
              </Typography.Text>
            </div>

            {(opened.decision?.reasons.length ?? 0) > 0 && (
              <div className={styles.block}>
                <Typography.Title tag="h3" view="xsmall" weight="bold">
                  Результат проверки
                </Typography.Title>
                {opened.decision?.reasons.map((r) => (
                  <p className={styles.reason} key={r.code}>
                    {r.text}
                  </p>
                ))}
              </div>
            )}

            {opened.finalOffer && (
              <div className={styles.block}>
                <Typography.Title tag="h3" view="xsmall" weight="bold">
                  Условия
                </Typography.Title>
                <dl className={styles.detailFacts}>
                  <div>
                    <dt>Сумма</dt>
                    <dd>{formatRub(opened.finalOffer.amount)}</dd>
                  </div>
                  <div>
                    <dt>Срок</dt>
                    <dd>{opened.finalOffer.termMonths} мес.</dd>
                  </div>
                  <div>
                    <dt>Ставка</dt>
                    <dd>{opened.finalOffer.annualRatePercent}%</dd>
                  </div>
                  <div>
                    <dt>Платёж</dt>
                    <dd>{formatRub(opened.finalOffer.monthlyPayment)}</dd>
                  </div>
                </dl>
                {opened.decision?.changes.map((c) => (
                  <p className={styles.change} key={c.field}>
                    {OFFER_FIELD_LABELS[c.field] || 'Условие'}: {c.requested} → {c.offered}
                  </p>
                ))}
              </div>
            )}

            {['APPROVED', 'COUNTER_OFFERED'].includes(opened.status) && (
              <div className={styles.actionsRow}>
                <Button view="accent" size={48} disabled={busy} onClick={() => void act('accept')}>
                  Принять условия — демо
                </Button>
                <Button
                  view="outlined"
                  size={48}
                  disabled={busy}
                  onClick={() => void act('decline')}
                >
                  Отказаться от предложения
                </Button>
              </div>
            )}

            {opened.status === 'CHECK_FAILED' && (
              <div className={styles.actionsRow}>
                <Button
                  view="accent"
                  size={48}
                  disabled={busy}
                  onClick={() => void act('retry-check')}
                >
                  Повторить проверку
                </Button>
              </div>
            )}

            {opened.status === 'NEEDS_CLARIFICATION' && (
              <div className={styles.block}>
                <Typography.Title tag="h3" view="xsmall" weight="bold">
                  Нужно дополнить
                </Typography.Title>
                {opened.openRequests.map((r, i) => (
                  <p className={styles.reason} key={i}>
                    {r.message}
                  </p>
                ))}
                <Typography.Text view="primary-small" tag="div">
                  <Link to="/documents" target="_blank" rel="noreferrer">
                    Загрузить документ
                  </Link>
                  {' · '}
                  <Button
                    type="button"
                    view="text"
                    size={32}
                    onClick={() =>
                      getDocuments()
                        .then(setLibrary)
                        .catch((e) => setError(e.message))
                    }
                  >
                    Обновить библиотеку
                  </Button>
                </Typography.Text>
                <div className={styles.library}>
                  {library.map((d) => (
                    <Checkbox
                      key={d.id}
                      block
                      size={24}
                      label={d.title}
                      checked={attached.includes(d.id)}
                      onChange={(_, { checked }) =>
                        setAttached((old) =>
                          checked ? [...old, d.id] : old.filter((x) => x !== d.id),
                        )
                      }
                    />
                  ))}
                </div>
                <div className={styles.actionsRow}>
                  <Button
                    view="accent"
                    size={48}
                    disabled={busy}
                    onClick={() =>
                      void act('clarification-response', { attachedDocumentIds: attached })
                    }
                  >
                    Отправить дополнение
                  </Button>
                </div>
              </div>
            )}

            <div className={styles.block}>
              <Typography.Title tag="h3" view="xsmall" weight="bold">
                История
              </Typography.Title>
              <ul className={styles.history}>
                {opened.history.map((h, i) => (
                  <li key={i}>
                    <time>{new Date(h.at).toLocaleString('ru-RU')}</time> · {h.message}
                  </li>
                ))}
              </ul>
            </div>
          </Modal.Content>
          <Modal.Footer>
            {opened.status === 'DRAFT' && (
              <Button
                view="accent"
                size={48}
                onClick={() => navigate('/wizard?applicationId=' + opened.id)}
              >
                Продолжить заявку
              </Button>
            )}
            {(opened.status === 'REJECTED' || opened.status === 'DECLINED_BY_CLIENT') && (
              <Button view="outlined" size={48} onClick={() => navigate('/credits')}>
                Подобрать другой кредит
              </Button>
            )}
            <Button view="secondary" size={48} onClick={close}>
              Закрыть
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
