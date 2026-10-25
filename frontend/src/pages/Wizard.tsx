import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@alfalab/core-components/button';
import { Checkbox } from '@alfalab/core-components/checkbox';
import { Dropzone } from '@alfalab/core-components/dropzone';
import { Input } from '@alfalab/core-components/input';
import { Notification } from '@alfalab/core-components/notification';
import { ProgressBar } from '@alfalab/core-components/progress-bar';
import { SliderInput } from '@alfalab/core-components/slider-input';
import { Tag } from '@alfalab/core-components/tag';
import { Typography } from '@alfalab/core-components/typography';
import { useApp } from '../context/AppContext';
import { formatMonths, formatRub } from '../utils/format';
import styles from './Wizard.module.css';

interface WizardLocationState {
  productId?: string;
  purpose?: string;
  amount?: number;
  months?: number;
}

const STEPS = ['Параметры', 'Компания', 'Документы', 'Проверка'] as const;
const LAST_STEP = STEPS.length - 1;

const AMOUNT = { min: 100_000, max: 3_000_000, step: 10_000, initial: 750_000 };
const MONTHS = { min: 6, max: 36, step: 1, initial: 12 };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const initialNumber = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;

export default function Wizard() {
  const navigate = useNavigate();
  const { user } = useApp();
  const incoming = (useLocation().state as WizardLocationState | null) ?? {};

  const [step, setStep] = useState(0);
  const [amountInput, setAmountInput] = useState<number | ''>(
    clamp(initialNumber(incoming.amount, AMOUNT.initial), AMOUNT.min, AMOUNT.max),
  );
  const [monthsInput, setMonthsInput] = useState<number | ''>(
    clamp(initialNumber(incoming.months, MONTHS.initial), MONTHS.min, MONTHS.max),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const redirectTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  const amount = clamp(Number(amountInput) || AMOUNT.min, AMOUNT.min, AMOUNT.max);
  const months = clamp(Number(monthsInput) || MONTHS.min, MONTHS.min, MONTHS.max);
  const purpose = incoming.purpose || 'Развитие';
  const equipment = /equip|оборудован/i.test(incoming.productId ?? '');
  const productName = equipment ? 'Кредит на оборудование' : 'Кредит на развитие бизнеса';

  const progress = ((step + 1) / STEPS.length) * 100;
  const notSpecified = 'Не указано';

  const addFiles = (list: File[]) =>
    setFiles((prev) => [...prev, ...list.filter((f) => !prev.some((p) => p.name === f.name))]);

  const next = () => {
    // Фиксируем значения, введённые вручную, чтобы в сводке не осталось пустых полей.
    setAmountInput(amount);
    setMonthsInput(months);
    setStep((s) => Math.min(LAST_STEP, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = () => {
    if (!confirmed) {
      setConsentError(true);
      return;
    }
    setSubmitted(true);
    redirectTimer.current = window.setTimeout(() => navigate('/applications'), 1800);
  };

  return (
    <>
      <div className="page-head">
        <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
          Заявка
        </Typography.Text>
        <Typography.Title tag="h1" view="large" weight="bold">
          Заявка на кредит
        </Typography.Title>
        <Typography.Text view="primary-medium" color="secondary" tag="div">
          Шаг {step + 1} из {STEPS.length}. Проверьте данные перед отправкой.
        </Typography.Text>
      </div>

      <ol className={styles.stepper} aria-label="Шаги заявки">
        {STEPS.map((title, i) => (
          <li
            key={title}
            aria-current={i === step ? 'step' : undefined}
            className={`${styles.step} ${i === step ? styles.stepCurrent : ''} ${i < step ? styles.stepDone : ''}`}
          >
            <span className={styles.stepNum} aria-hidden="true">
              {i < step ? '✓' : i + 1}
            </span>
            {title}
          </li>
        ))}
      </ol>

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="wizard-step-title">
          {step === 0 && (
            <>
              <Typography.Title tag="h2" view="small" weight="bold" id="wizard-step-title">
                Сколько и на какой срок?
              </Typography.Title>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Цель «{purpose}» и продукт уже выбраны при подборе.
              </Typography.Text>
              <div className={styles.body}>
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
                <Typography.Text view="primary-small" color="secondary" tag="div" className={styles.note}>
                  Это запрос клиента. Банк может предложить другие условия после проверки.
                </Typography.Text>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Typography.Title tag="h2" view="small" weight="bold" id="wizard-step-title">
                Данные компании
              </Typography.Title>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Данные подтянуты из вашего профиля. Проверьте, что вы используете нужный аккаунт.
              </Typography.Text>
              <div className={styles.body}>
                <Input
                  label="Компания"
                  block
                  size={56}
                  readOnly
                  value={user?.companyName ?? notSpecified}
                />
                <div className={styles.fieldsRow}>
                  <Input label="ИНН" block size={56} readOnly value={user?.inn ?? notSpecified} />
                  <Input
                    label="ФИО"
                    block
                    size={56}
                    readOnly
                    value={user?.fullName ?? user?.firstName ?? notSpecified}
                  />
                </div>
                <Typography.Text view="primary-small" color="secondary" tag="div" className={styles.note}>
                  Изменить данные компании в заявке нельзя. Если они устарели, обратитесь в банк.
                </Typography.Text>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Typography.Title tag="h2" view="small" weight="bold" id="wizard-step-title">
                Документы
              </Typography.Title>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Нужны финансовый документ (например, выписка) и документ компании.
              </Typography.Text>
              <div className={styles.body}>
                <Dropzone block className={styles.dropzone} onDrop={addFiles}>
                  <div className={styles.dropzoneContent}>
                    <span className={styles.dropzoneIcon} aria-hidden="true">
                      ⇪
                    </span>
                    <Typography.Text view="primary-medium" weight="bold" tag="div">
                      Перетащите файлы сюда
                    </Typography.Text>
                    <Typography.Text view="primary-small" color="secondary" tag="div">
                      или
                    </Typography.Text>
                    <Button view="secondary" size={40} onClick={() => fileInputRef.current?.click()}>
                      Выбрать файл
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className={styles.hiddenInput}
                      onChange={(e) => {
                        addFiles(Array.from(e.target.files ?? []));
                        e.target.value = '';
                      }}
                    />
                  </div>
                </Dropzone>

                {files.length > 0 && (
                  <ul className={styles.files}>
                    {files.map((file) => (
                      <li key={file.name} className={styles.file}>
                        <span className={styles.fileName}>{file.name}</span>
                        <Button
                          view="text"
                          size={32}
                          onClick={() => setFiles((prev) => prev.filter((f) => f !== file))}
                        >
                          Убрать
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <Typography.Text view="primary-small" color="secondary" tag="div" className={styles.note}>
                  Демонстрация: файлы не отправляются на сервер.
                </Typography.Text>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Typography.Title tag="h2" view="small" weight="bold" id="wizard-step-title">
                Проверка и отправка
              </Typography.Title>
              <Typography.Text view="primary-small" color="secondary" tag="div">
                Проверьте данные. После отправки появится номер и статус заявки.
              </Typography.Text>
              <div className={styles.body}>
                <dl className={styles.summary}>
                  <div>
                    <dt>Продукт</dt>
                    <dd>{productName}</dd>
                  </div>
                  <div>
                    <dt>Цель</dt>
                    <dd>{purpose}</dd>
                  </div>
                  <div>
                    <dt>Сумма</dt>
                    <dd>{formatRub(amount)}</dd>
                  </div>
                  <div>
                    <dt>Срок</dt>
                    <dd>{formatMonths(months)}</dd>
                  </div>
                  <div>
                    <dt>Компания</dt>
                    <dd>{user?.companyName ?? notSpecified}</dd>
                  </div>
                  <div>
                    <dt>ИНН</dt>
                    <dd>{user?.inn ?? notSpecified}</dd>
                  </div>
                  <div>
                    <dt>Документы</dt>
                    <dd>{files.length ? `${files.length} шт.` : 'Не добавлены'}</dd>
                  </div>
                </dl>

                <Checkbox
                  block
                  size={24}
                  checked={confirmed}
                  error={consentError && !confirmed ? 'Подтвердите данные, чтобы отправить заявку' : undefined}
                  label="Я подтверждаю данные"
                  onChange={(_, { checked }) => {
                    setConfirmed(checked);
                    if (checked) setConsentError(false);
                  }}
                />
              </div>
            </>
          )}

          <div className={styles.actions}>
            {step > 0 && (
              <Button view="outlined" size={48} onClick={back} disabled={submitted}>
                Назад
              </Button>
            )}
            <span className={styles.spacer} />
            {step < LAST_STEP ? (
              <Button view="accent" size={48} onClick={next}>
                Далее →
              </Button>
            ) : (
              <Button view="accent" size={48} onClick={submit} loading={submitted}>
                Отправить заявку
              </Button>
            )}
          </div>
        </section>

        <aside className={`${styles.aside}`} aria-label="Сводка заявки">
          <div className={styles.card}>
            <Typography.Text view="secondary-small" color="secondary" className="eyebrow">
              Ваша заявка
            </Typography.Text>
            <Typography.Title tag="h2" view="small" weight="bold" className={styles.asideProduct}>
              {productName}
            </Typography.Title>
            <dl className={styles.asideFacts}>
              <div>
                <dt>Сумма</dt>
                <dd>{formatRub(amount)}</dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>{formatMonths(months)}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>
                  <Tag view="filled" size={32} className="tag tag--purple">
                    {submitted ? 'Отправлена' : 'Черновик'}
                  </Tag>
                </dd>
              </div>
            </dl>
            <div className={styles.progressLabel}>
              <Typography.Text view="secondary-small" color="secondary">
                Заполнение
              </Typography.Text>
              <Typography.Text view="secondary-small" weight="bold">
                {progress}%
              </Typography.Text>
            </div>
            <ProgressBar value={progress} view="accent" size={8} aria-label="Прогресс заполнения заявки" />
          </div>
        </aside>
      </div>

      <Notification
        badge="positive-checkmark"
        title="Заявка отправлена"
        visible={submitted}
        offset={88}
        autoCloseDelay={null}
      >
        Переходим к списку заявок…
      </Notification>
    </>
  );
}
