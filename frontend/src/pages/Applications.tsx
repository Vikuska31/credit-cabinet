import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { Modal } from '@alfalab/core-components/modal';
import { Segment, SegmentedControl } from '@alfalab/core-components/segmented-control';
import { Spinner } from '@alfalab/core-components/spinner';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { useApp } from '../context/AppContext';
import { APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus } from '../types';
import { formatMonths, formatRub } from '../utils/format';
import { STATUS_TONE, isFinalStatus } from '../utils/status';
import styles from './Applications.module.css';

/** Телефон банка — заглушка, замените на актуальный контакт. */
const BANK_PHONE = '88002002000';

const MOCK_APPLICATIONS: Application[] = [
  {
    id: 'DEMO-003',
    product: 'Кредит на оборудование',
    purpose: 'Оборудование',
    amount: 1_500_000,
    months: 24,
    status: 'needs-info',
    createdAt: '2026-10-21T10:15:00',
  },
  {
    id: 'DEMO-002',
    product: 'Кредит на развитие бизнеса',
    purpose: 'Развитие',
    amount: 750_000,
    months: 12,
    status: 'approved',
    createdAt: '2026-10-12T14:40:00',
  },
  {
    id: 'DEMO-001',
    product: 'Кредит на развитие бизнеса',
    purpose: 'Реклама',
    amount: 300_000,
    months: 6,
    status: 'rejected',
    createdAt: '2026-09-28T09:05:00',
  },
];

type Filter = 'all' | 'active' | 'done';

const NOW_TEXT: Record<ApplicationStatus, string> = {
  draft: 'Заявка ещё не отправлена. Продолжите оформление с того же шага.',
  processing: 'Заявка отправлена. Банк проверяет данные.',
  review: 'Проверяются сведения и документы.',
  'needs-info': 'Нужны дополнительные сведения или новый документ.',
  counter: 'Банк предложил другие условия. Сравните их с вашим запросом.',
  approved: 'Предложение готово. Проверьте условия и подтвердите.',
  rejected: 'Банк отказал по этой заявке. Можно посмотреть другие варианты.',
  declined: 'Вы отказались от предложенных условий. Можно выбрать другой кредит.',
  accepted: 'Условия подтверждены. Осталось завершить подписание.',
  signed: 'Подтверждение получено. Готовим выдачу.',
  issued: 'Оформление завершено.',
};

const STAGES = ['Заявка отправлена', 'Проверка', 'Решение или уточнение', 'Принятие и выдача'] as const;
type StageState = 'done' | 'current' | 'todo';

/** Состояние каждого из четырёх этапов для данного статуса. */
function getStages(status: ApplicationStatus): StageState[] {
  switch (status) {
    case 'draft':
      return ['todo', 'todo', 'todo', 'todo'];
    case 'processing':
    case 'review':
      return ['done', 'current', 'todo', 'todo'];
    case 'needs-info':
    case 'counter':
    case 'approved':
    case 'rejected':
    case 'declined':
      return ['done', 'done', 'current', 'todo'];
    case 'accepted':
    case 'signed':
      return ['done', 'done', 'done', 'current'];
    case 'issued':
      return ['done', 'done', 'done', 'done'];
  }
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
function formatDate(value?: string): string {
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

function ApplicationDetails({ app, onClose }: { app: Application; onClose: () => void }) {
  const navigate = useNavigate();
  const stages = getStages(app.status);

  return (
    <Modal open onClose={onClose} size={600}>
      <Modal.Header hasCloser title={`Заявка № ${app.id}`} />
      <Modal.Content>
        <div className={styles.detailHead}>
          <StatusTag status={app.status} />
          <Typography.Text view="primary-large" weight="bold" tag="div">
            {app.product}
          </Typography.Text>
        </div>

        <dl className={styles.detailFacts}>
          <div>
            <dt>Сумма</dt>
            <dd>{formatRub(app.amount)}</dd>
          </div>
          <div>
            <dt>Срок</dt>
            <dd>{formatMonths(app.months)}</dd>
          </div>
          <div>
            <dt>Создана</dt>
            <dd>{formatDate(app.createdAt)}</dd>
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
            {NOW_TEXT[app.status]}
          </Typography.Text>
        </div>
      </Modal.Content>
      <Modal.Footer>
        <Button view="accent" size={48} href={`tel:${BANK_PHONE}`}>
          Связаться с банком
        </Button>
        {app.status === 'draft' && (
          <Button view="outlined" size={48} onClick={() => navigate('/wizard')}>
            Продолжить заявку
          </Button>
        )}
        {(app.status === 'rejected' || app.status === 'declined') && (
          <Button view="outlined" size={48} onClick={() => navigate('/credits')}>
            Подобрать другой кредит
          </Button>
        )}
        <Button view="secondary" size={48} onClick={onClose}>
          Закрыть
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function Applications() {
  const navigate = useNavigate();
  const { applications, applicationsStatus } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  
  const loading = applicationsStatus === 'idle' || applicationsStatus === 'loading';
  // Бэкенд недоступен — показываем демонстрационные заявки, чтобы экран не пустовал.
  const usingMock = applicationsStatus === 'error';
  const source = usingMock ? MOCK_APPLICATIONS : applications;

  const sorted = useMemo(() => [...source].sort((a, b) => createdTime(b) - createdTime(a)), [source]);
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
        filter === 'all' ? true : filter === 'active' ? !isFinalStatus(a.status) : isFinalStatus(a.status),
      ),
    [sorted, filter],
  );
  const opened = sorted.find((a) => a.id === openId) ?? null;

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

      {loading && (
        <div className={styles.loader}>
          <Spinner visible preset={24} />
        </div>
      )}

      {!loading && usingMock && (
        <Typography.Text view="primary-small" tag="div" className={styles.demoNote}>
          Не удалось загрузить заявки с сервера — показаны демонстрационные данные.
        </Typography.Text>
      )}

      {!loading && sorted.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">
            ▤
          </div>
          <Typography.Title tag="h2" view="small" weight="bold">
            Заявок пока нет
          </Typography.Title>
          <Typography.Text view="primary-medium" color="secondary" tag="div" className={styles.emptyText}>
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
              onChange={(id) => setFilter(id as Filter)}
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
                      <div className={styles.cardTitle}>{app.product}</div>
                      <Typography.Text view="secondary-small" color="secondary">
                        Заявка № {app.id}
                      </Typography.Text>
                    </div>
                    <dl className={`${styles.fact} ${styles.facts}`}>
                      <dt>Сумма и срок</dt>
                      <dd>
                        {formatRub(app.amount)} · {formatMonths(app.months)}
                      </dd>
                    </dl>
                    <dl className={`${styles.fact} ${styles.facts}`}>
                      <dt>Создана</dt>
                      <dd>{formatDate(app.createdAt)}</dd>
                    </dl>
                    <Button view="secondary" size={40} onClick={() => setOpenId(app.id)}>
                      Подробнее →
                    </Button>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {opened && <ApplicationDetails app={opened} onClose={() => setOpenId(null)} />}
    </>
  );
}
