import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocumentPdfMIcon } from '@alfalab/icons-glyph/DocumentPdfMIcon';
import { Button } from '@alfalab/core-components/button';
import { Tab, Tabs } from '@alfalab/core-components/tabs';
import { Typography } from '@alfalab/core-components/typography';
import { getDocuments, uploadDocument } from '../api/catalog';
import { downloadDocument } from '../api/client';
import type { DocumentRef } from '../types';
import { DOCUMENT_LABELS } from '../utils/documents';
import styles from './Documents.module.css';

type Filter = 'all' | 'fin' | 'purchase';

/** «Финансовые» — отчётность и сводки; «По покупке и работам» — документы под цель кредита. */
const FINANCIAL = [
  'FINANCIAL_SUMMARY',
  'TAX_DECLARATION',
  'ACCOUNTING_REPORTS',
  'TAX_DEBT_CERTIFICATE',
];

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const formatDate = (value: string) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? '—' : dateFormat.format(time);
};

export default function Documents() {
  const [documents, setDocuments] = useState<DocumentRef[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const selected = documents.find((d) => d.id === params.get('documentId'));

  useEffect(() => {
    getDocuments()
      .then(setDocuments)
      .catch((e) => setError(e.message));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      await uploadDocument(new FormData(form));
      setDocuments(await getDocuments());
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить документ');
    } finally {
      setBusy(false);
    }
  };

  const visible = documents.filter(
    (d) =>
      filter === 'all' ||
      (filter === 'fin' ? FINANCIAL.includes(d.type) : !FINANCIAL.includes(d.type)),
  );

  return (
    <>
      <div className="page-head">
        <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
          Библиотека компании
        </Typography.Text>
        <Typography.Title tag="h1" view="large" weight="bold">
          Документы
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary" tag="div">
          Файлы сохраняются в библиотеке и могут использоваться в нескольких заявках.
        </Typography.Text>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {params.has('documentId') && !selected && documents.length > 0 && (
        <p role="alert" className={styles.error}>
          Документ не найден в доступной библиотеке.
        </p>
      )}

      {selected && (
        <section className={styles.panel}>
          <h2>{selected.title}</h2>
          <Typography.Text view="primary-medium" color="secondary" tag="div">
            {DOCUMENT_LABELS[selected.type] ?? selected.type} · версия {selected.version}
          </Typography.Text>
          <Typography.Text view="primary-small" tag="div">
            Период: {selected.periodFrom || 'не указан'} — {selected.periodTo || 'не указан'}
          </Typography.Text>
          <div className={styles.panelActions}>
            <Button
              view="accent"
              size={48}
              onClick={() => void downloadDocument(selected.id).catch((e) => setError(e.message))}
            >
              Скачать файл
            </Button>
            <Button view="secondary" size={48} onClick={() => setParams({})}>
              Закрыть
            </Button>
          </div>
        </section>
      )}

      <div className={styles.toolbar}>
        <Tabs
          selectedId={filter}
          onChange={(_, { selectedId }) => setFilter(selectedId as Filter)}
          size="m"
        >
          <Tab id="all" title="Все" />
          <Tab id="fin" title="Финансовые" />
          <Tab id="purchase" title="По покупке и работам" />
        </Tabs>
      </div>

      <ul className={styles.grid}>
        {visible.length === 0 && (
          <li className={styles.empty}>
            <Typography.Text view="primary-medium" color="secondary" tag="div">
              В этой категории пока нет документов. Загрузите файл ниже.
            </Typography.Text>
          </li>
        )}
        {visible.map((d) => (
          <li key={d.id}>
            <section className={styles.card}>
              <div className={styles.icon}>
                <DocumentPdfMIcon aria-label="PDF" />
              </div>
              <h2 className={styles.name}>{d.title}</h2>
              <dl className={styles.meta}>
                <div>
                  <dt className="visually-hidden">Тип:</dt>
                  <dd>
                    {DOCUMENT_LABELS[d.type] ?? d.type} · версия {d.version}
                  </dd>
                </div>
                <div>
                  <dt className="visually-hidden">Загружен:</dt>
                  <dd>{formatDate(d.uploadedAt)}</dd>
                </div>
              </dl>
              <div className={styles.actions}>
                <Button
                  className={styles.download}
                  view="secondary"
                  size={40}
                  onClick={() => setParams({ documentId: d.id })}
                >
                  Открыть документ
                </Button>
              </div>
            </section>
          </li>
        ))}
      </ul>

      <form className={styles.form} onSubmit={(e) => void submit(e)}>
        <Typography.Title tag="h2" view="small" weight="bold">
          Загрузить документ
        </Typography.Title>
        <div className={styles.fields}>
          <label className={styles.field}>
            Название
            <input name="title" required maxLength={200} />
          </label>
          <label className={styles.field}>
            Тип
            <select name="type" aria-label="Тип">
              {Object.entries(DOCUMENT_LABELS).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.formHint}>
            Для финансовой сводки, декларации и отчётности укажите начало и конец периода.
          </p>
          <label className={styles.field}>
            Начало периода
            <input type="month" name="periodFrom" />
          </label>
          <label className={styles.field}>
            Конец периода
            <input type="month" name="periodTo" />
          </label>
          <label className={styles.field}>
            PDF-файл до 20 МБ
            <input type="file" name="file" accept="application/pdf,.pdf" required />
          </label>
        </div>
        <Button type="submit" view="accent" size={48} loading={busy} disabled={busy}>
          {busy ? 'Загружаем…' : 'Сохранить в библиотеку'}
        </Button>
      </form>
    </>
  );
}
