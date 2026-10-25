import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDocuments, uploadDocument } from '../api/catalog';
import { downloadDocument } from '../api/client';
import type { DocumentRef } from '../types';
import { DOCUMENT_LABELS } from '../utils/documents';
export default function Documents() {
  const [documents, setDocuments] = useState<DocumentRef[]>([]);
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
  return (
    <>
      <div className="page-head">
        <h1>Документы компании</h1>
        <p>Файлы сохраняются в библиотеке и могут использоваться в нескольких заявках.</p>
      </div>
      {error && (
        <p role="alert" className="cc-error">
          {error}
        </p>
      )}
      {params.has('documentId') && !selected && <p>Документ не найден в доступной библиотеке.</p>}
      {selected && (
        <section className="cc-card cc-detail">
          <h2>{selected.title}</h2>
          <p>
            {DOCUMENT_LABELS[selected.type]} · версия {selected.version}
          </p>
          <p>
            Период: {selected.periodFrom || 'не указан'} — {selected.periodTo || 'не указан'}
          </p>
          <button
            className="cc-button"
            onClick={() => void downloadDocument(selected.id).catch((e) => setError(e.message))}
          >
            Скачать файл
          </button>
          <button onClick={() => setParams({})}>Закрыть</button>
        </section>
      )}
      <div className="cc-grid">
        {documents.map((d) => (
          <section className="cc-card" key={d.id}>
            <h2>{d.title}</h2>
            <p>
              {DOCUMENT_LABELS[d.type]} · версия {d.version}
            </p>
            <button className="cc-button secondary" onClick={() => setParams({ documentId: d.id })}>
              Открыть документ
            </button>
          </section>
        ))}
      </div>
      <form className="cc-card cc-form" onSubmit={(e) => void submit(e)}>
        <h2>Загрузить документ</h2>
        <label>
          Название
          <input name="title" required maxLength={200} />
        </label>
        <label>
          Тип
          <select name="type" aria-label="Тип">
            {Object.entries(DOCUMENT_LABELS).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="cc-grid">
          <p>Для финансовой сводки, декларации и отчётности укажите начало и конец периода.</p>
          <label>
            Начало периода
            <input type="month" name="periodFrom" />
          </label>
          <label>
            Конец периода
            <input type="month" name="periodTo" />
          </label>
        </div>
        <label>
          PDF-файл до 20 МБ
          <input type="file" name="file" accept="application/pdf,.pdf" required />
        </label>
        <button className="cc-button" disabled={busy}>
          {busy ? 'Загружаем…' : 'Сохранить в библиотеку'}
        </button>
      </form>
    </>
  );
}
