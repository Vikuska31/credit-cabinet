import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { APPLICATION_STATUS_LABELS, FINAL_APPLICATION_STATUSES } from '../types';
import { formatRub } from '../utils/format';
export default function Home() {
  const { user, applications, applicationsStatus, applicationsError, refreshApplications } =
    useApp();
  const active = applications.find((a) => !FINAL_APPLICATION_STATUSES.includes(a.status));
  return (
    <>
      <div className="page-head">
        <h1>Привет, {user?.firstName || user?.fullName}!</h1>
        <p>
          {user?.companyName} · ИНН {user?.inn}
        </p>
      </div>
      <div className="cc-grid">
        <section className="cc-card">
          <h2>С чего начнём?</h2>
          <p>Выберите бизнес-цель и сравните предварительные расчёты.</p>
          <Link className="cc-button" to="/credits">
            Подобрать кредит
          </Link>
        </section>
        <section className="cc-card">
          <h2>Активная заявка</h2>
          {applicationsStatus === 'loading' ? (
            <p>Загрузка…</p>
          ) : active ? (
            <>
              <p>
                № {active.number} · {APPLICATION_STATUS_LABELS[active.status]}
              </p>
              <p>{active.amount != null ? formatRub(active.amount) : 'Сумма не указана'}</p>
              <Link
                className="cc-button secondary"
                to={
                  (active.status === 'DRAFT' ? '/wizard' : '/applications') +
                  '?applicationId=' +
                  active.id
                }
              >
                Открыть заявку
              </Link>
            </>
          ) : (
            <p>Пока нет активных заявок.</p>
          )}
          {applicationsError && (
            <>
              <p role="alert">{applicationsError}</p>
              <button onClick={() => void refreshApplications()}>Повторить</button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
