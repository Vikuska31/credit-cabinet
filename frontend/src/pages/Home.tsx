import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { Notification } from '@alfalab/core-components/notification';
import { Spinner } from '@alfalab/core-components/spinner';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { useApp } from '../context/AppContext';
import {
  APPLICATION_STATUS_LABELS,
  FINAL_APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
} from '../types';
import { formatMonths, formatRub } from '../utils/format';
import { STATUS_TONE } from '../utils/status';

/** Что банк ждёт от клиента — выше в списке. */
const PRIORITY: Partial<Record<ApplicationStatus, number>> = {
  NEEDS_CLARIFICATION: 0,
  COUNTER_OFFERED: 0,
  CHECK_FAILED: 0,
  APPROVED: 1,
  DRAFT: 2,
  UNDER_REVIEW: 3,
};

interface NextStep {
  text: string;
  cta: string;
  to: string;
}

function pickActive(applications: Application[]): Application | null {
  const active = applications.filter((a) => !FINAL_APPLICATION_STATUSES.includes(a.status));
  if (!active.length) return null;
  const time = (a: Application) => Date.parse(a.updatedAt ?? a.createdAt ?? '') || 0;
  return [...active].sort(
    (a, b) => (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9) || time(b) - time(a),
  )[0];
}

/** Куда вести клиента по заявке: черновик — в мастер, остальное — в «Заявки». */
const linkFor = (app: Application) =>
  `${app.status === 'DRAFT' ? '/wizard' : '/applications'}?applicationId=${app.id}`;

function getNextStep(app: Application | null): NextStep {
  if (!app) {
    return {
      text: 'Выберите бизнес-цель и сравните предварительные расчёты. Просмотр не создаёт заявку.',
      cta: 'Подобрать кредит',
      to: '/credits',
    };
  }
  const to = linkFor(app);
  switch (app.status) {
    case 'NEEDS_CLARIFICATION':
      return {
        text: 'Для рассмотрения заявки банку нужны дополнительные сведения.',
        cta: 'Добавить сведения',
        to,
      };
    case 'CHECK_FAILED':
      return {
        text: 'Проверка не завершилась из-за технического сбоя. Её можно повторить.',
        cta: 'Повторить проверку',
        to,
      };
    case 'COUNTER_OFFERED':
      return {
        text: 'Банк предложил другие условия. Сравните их с вашим запросом.',
        cta: 'Посмотреть предложение',
        to,
      };
    case 'APPROVED':
      return {
        text: 'Предложение готово. Проверьте условия и подтвердите.',
        cta: 'Открыть предложение',
        to,
      };
    case 'DRAFT':
      return {
        text: 'Продолжите заявку с того же шага, где остановились.',
        cta: 'Продолжить заявку',
        to,
      };
    default:
      return {
        text: 'Проверьте ход рассмотрения и следующее действие.',
        cta: 'Открыть заявку',
        to,
      };
  }
}

function StatusTag({ status }: { status: ApplicationStatus }) {
  return (
    <Tag view="filled" size={32} className={`tag tag--${STATUS_TONE[status]}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </Tag>
  );
}

export default function Home() {
  const { user, applications, applicationsStatus, applicationsError, refreshApplications } =
    useApp();
  const navigate = useNavigate();

  const loading = applicationsStatus === 'loading' || applicationsStatus === 'idle';
  const failed = applicationsStatus === 'error';
  const active = useMemo(() => pickActive(applications), [applications]);
  const next = getNextStep(active);

  const name = user?.firstName ?? user?.fullName?.split(/\s+/)[0] ?? 'предприниматель';
  const months = active?.months ?? active?.termMonths ?? null;

  return (
    <>
      <div className="page-head">
        <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
          {user?.companyName ? `${user.companyName} · ИНН ${user.inn}` : 'Умный кредитный кабинет'}
        </Typography.Text>
        <Typography.Title tag="h1" view="large" weight="bold">
          Привет, {name}!
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary" tag="div">
          Всё важное по кредитам и заявкам в одном месте.
        </Typography.Text>
      </div>

      <div className="home-grid">
        <section className="panel panel--accent" aria-labelledby="next-title">
          <Typography.Title tag="h2" view="small" weight="bold" id="next-title">
            Что дальше?
          </Typography.Title>
          {loading ? (
            <div className="panel__loader">
              <Spinner visible preset={24} colors="inverted" />
            </div>
          ) : (
            <>
              <Typography.Text view="primary-medium" tag="div" className="panel__text">
                {failed
                  ? 'Заявки пока недоступны, но подобрать кредит можно уже сейчас.'
                  : next.text}
              </Typography.Text>
              <Button
                view="outlined"
                size={48}
                colors="inverted"
                onClick={() => navigate(failed ? '/credits' : next.to)}
              >
                {failed ? 'Подобрать кредит' : next.cta} →
              </Button>
            </>
          )}
        </section>

        <section className="panel" aria-labelledby="active-title">
          <Typography.Title tag="h2" view="small" weight="bold" id="active-title">
            Активная заявка
          </Typography.Title>

          {loading && (
            <div className="panel__loader">
              <Spinner visible preset={24} />
            </div>
          )}

          {!loading && failed && (
            <div className="empty">
              <Typography.Text view="primary-medium" tag="div">
                Не удалось загрузить заявки
              </Typography.Text>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Проверьте соединение и попробуйте снова.
              </Typography.Text>
              <Button view="secondary" size={40} onClick={() => void refreshApplications()}>
                Повторить
              </Button>
            </div>
          )}

          {!loading && !failed && !active && (
            <div className="empty">
              <Typography.Text view="primary-medium" tag="div">
                Заявок пока нет
              </Typography.Text>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Подбор кредита доступен без оформления. Заявка появится здесь после старта.
              </Typography.Text>
              <Button view="secondary" size={40} onClick={() => navigate('/credits')}>
                Перейти к кредитам
              </Button>
            </div>
          )}

          {!loading && !failed && active && (
            <div className="app-card">
              <StatusTag status={active.status} />
              <Typography.Text view="primary-large" weight="bold" tag="div">
                {active.product ?? 'Кредит для бизнеса'} · № {active.number}
              </Typography.Text>
              <dl className="app-card__facts">
                <div>
                  <dt>Сумма</dt>
                  <dd>{active.amount != null ? formatRub(active.amount) : 'Не указана'}</dd>
                </div>
                <div>
                  <dt>Срок</dt>
                  <dd>{months != null ? formatMonths(months) : 'Не указан'}</dd>
                </div>
              </dl>
              <Button view="secondary" size={40} onClick={() => navigate(linkFor(active))}>
                Статус и история →
              </Button>
            </div>
          )}
        </section>
      </div>

      <Notification
        badge="negative-alert"
        title="Не удалось загрузить заявки"
        visible={failed}
        autoCloseDelay={6000}
        offset={88}
        hasCloser
      >
        {applicationsError}
      </Notification>
    </>
  );
}
