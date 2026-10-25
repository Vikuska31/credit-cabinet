import { useRef, useState, type KeyboardEvent } from 'react';
import { DocumentAddMIcon } from '@alfalab/icons-glyph/DocumentAddMIcon';
import { DocumentImageMIcon } from '@alfalab/icons-glyph/DocumentImageMIcon';
import { DocumentPdfMIcon } from '@alfalab/icons-glyph/DocumentPdfMIcon';
import { DownloadMIcon } from '@alfalab/icons-glyph/DownloadMIcon';
import { Button } from '@alfalab/core-components/button';
import { Dropzone } from '@alfalab/core-components/dropzone';
import { Tab, Tabs } from '@alfalab/core-components/tabs';
import { Typography } from '@alfalab/core-components/typography';
import styles from './Documents.module.css';

type Category = 'fin' | 'equipment';
type Filter = 'all' | Category;
type FileType = 'PDF' | 'JPG';

interface DocumentItem {
  id: string;
  name: string;
  type: FileType;
  category: Category;
  uploadedAt: string;
  size: number;
}

const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: 'd1',
    name: 'Выписка по счёту за 3 квартал',
    type: 'PDF',
    category: 'fin',
    uploadedAt: '2026-10-05T11:20:00',
    size: 482_000,
  },
  {
    id: 'd2',
    name: 'Налоговая декларация за 2025 год',
    type: 'PDF',
    category: 'fin',
    uploadedAt: '2026-09-18T16:02:00',
    size: 1_240_000,
  },
  {
    id: 'd3',
    name: 'Договор поставки оборудования',
    type: 'PDF',
    category: 'equipment',
    uploadedAt: '2026-10-12T09:45:00',
    size: 2_150_000,
  },
  {
    id: 'd4',
    name: 'Счёт на оборудование (скан)',
    type: 'JPG',
    category: 'equipment',
    uploadedAt: '2026-10-14T13:30:00',
    size: 860_000,
  },
];

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
}

const fileType = (file: File): FileType =>
  /\.(jpe?g|png)$/i.test(file.name) || file.type.startsWith('image/') ? 'JPG' : 'PDF';

export default function Documents() {
  const [filter, setFilter] = useState<Filter>('all');
  const [documents, setDocuments] = useState<DocumentItem[]>(MOCK_DOCUMENTS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visible = documents.filter((d) => filter === 'all' || d.category === filter);

  const handleDownload = (doc: DocumentItem) => {
    console.log('Скачать документ:', doc);
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleFiles = (files: File[]) => {
    if (!files.length) return;
    console.log('Загружены файлы:', files);
    const now = new Date().toISOString();
    const added: DocumentItem[] = files.map((file, i) => ({
      id: `upload-${Date.now()}-${i}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      type: fileType(file),
      category: filter === 'equipment' ? 'equipment' : 'fin',
      uploadedAt: now,
      size: file.size,
    }));
    setDocuments((prev) => [...added, ...prev]);
  };

  const openPicker = () => fileInputRef.current?.click();
  const onZoneKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  };

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
          Один раздел для хранения и повторного использования файлов в новых заявках.
        </Typography.Text>
      </div>

      <div className={styles.toolbar}>
        <Tabs
          selectedId={filter}
          onChange={(_, { selectedId }) => setFilter(selectedId as Filter)}
          size="m"
        >
          <Tab id="all" title="Все" />
          <Tab id="fin" title="Финансовые" />
          <Tab id="equipment" title="По оборудованию" />
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
        {visible.map((doc) => {
          const Icon = doc.type === 'PDF' ? DocumentPdfMIcon : DocumentImageMIcon;
          return (
            <li key={doc.id}>
              <article className={styles.card}>
                <div className={`${styles.icon} ${doc.type === 'JPG' ? styles.iconImage : ''}`}>
                  <Icon aria-label={doc.type} />
                </div>
                <div className={styles.name}>{doc.name}</div>
                <dl className={styles.meta}>
                  <div>
                    <dt className="visually-hidden">Загружен:</dt>
                    <dd>{dateFormat.format(Date.parse(doc.uploadedAt))}</dd>
                  </div>
                  <div>
                    <dt className="visually-hidden">Размер:</dt>
                    <dd>
                      {doc.type} · {formatSize(doc.size)}
                    </dd>
                  </div>
                </dl>
                <div className={styles.actions}>
                  <Button
                    className={styles.download}
                    view="secondary"
                    size={40}
                    leftAddons={<DownloadMIcon />}
                    onClick={() => handleDownload(doc)}
                  >
                    Скачать
                  </Button>
                  <Button
                    view="text"
                    size={40}
                    onClick={() => handleDelete(doc.id)}
                    aria-label="Удалить документ"
                    style={{ color: '#ef3124' }}
                    >
                    ✕
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <Dropzone block className={styles.dropzone} onDrop={handleFiles}>
        <div
          className={styles.dropzoneContent}
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={onZoneKey}
        >
          <span className={styles.dropzoneIcon} aria-hidden="true">
            <DocumentAddMIcon />
          </span>
          <Typography.Text view="primary-large" weight="bold" tag="div">
            Перетащите файлы сюда или нажмите для загрузки
          </Typography.Text>
          <Typography.Text view="primary-small" color="secondary" tag="div">
            PDF, JPG или PNG. Демонстрация: на сервер файлы пока не отправляются.
          </Typography.Text>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className={styles.hiddenInput}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              handleFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>
      </Dropzone>
    </>
  );
}