import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { askAssistant, capabilities, type AiAction, type AssistantResponse } from '../../api/ai';
import { assistantMessage } from '../../utils/ai';
export default function AssistantPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  useEffect(() => {
    capabilities()
      .then((c) => setEnabled(c.features.assistant))
      .catch(() => setEnabled(false));
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    const screens: Record<string, string> = {
      credits: 'CREDITS',
      wizard: 'WIZARD',
      applications: 'APPLICATIONS',
      documents: 'DOCUMENTS',
    };
    const params = new URLSearchParams(location.search);
    try {
      const r = await askAssistant(
        message,
        {
          screen: screens[location.pathname.split('/')[1]] || 'HOME',
          applicationId: params.get('applicationId'),
          documentId: params.get('documentId'),
        },
        history,
      );
      setResult(r);
      setHistory(
        [
          ...history,
          { role: 'user' as const, content: message },
          { role: 'assistant' as const, content: assistantMessage(r) },
        ].slice(-6),
      );
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помощник недоступен');
    } finally {
      setBusy(false);
    }
  };
  const apply = (a: AiAction) => {
    if (!result || a.requiresConfirmation !== true) return;
    switch (a.type) {
      case 'START_SELECTION':
        if (result.status !== 'READY' || result.fieldErrors.length) return;
        navigate('/credits', { state: { aiPrefill: result.entities } });
        break;
      case 'CONTINUE_DRAFT':
        if (a.applicationId)
          navigate('/wizard?applicationId=' + encodeURIComponent(a.applicationId));
        break;
      case 'OPEN_APPLICATION':
        if (a.applicationId)
          navigate('/applications?applicationId=' + encodeURIComponent(a.applicationId));
        break;
      case 'SHOW_DOCUMENT':
        if (a.documentId) navigate('/documents?documentId=' + encodeURIComponent(a.documentId));
        break;
      case 'EXPLAIN_TERMS':
        setError(result.reply);
        break;
      default:
        break;
    }
    setResult(null);
  };
  return (
    <details className="cc-assistant">
      <summary>Помощник по кредиту</summary>
      <div className="cc-assistant-body">
        <p>Опишите задачу. Проверьте предложенные параметры перед нажатием кнопки.</p>
        {!enabled ? (
          <p>Помощник отключён. Все разделы кабинета доступны вручную.</p>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            <label>
              Ваше сообщение
              <textarea
                required
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <button className="cc-button" disabled={busy}>
              {busy ? 'Обрабатываем…' : 'Отправить'}
            </button>
          </form>
        )}
        {error && <p role="status">{error}</p>}
        {result && (
          <div aria-live="polite">
            <p>{assistantMessage(result)}</p>
            {result.entities.purposeText && <p>Цель: {result.entities.purposeText}</p>}
            {result.entities.amount && (
              <p>
                Сумма: {result.entities.amount} {result.entities.currency}
              </p>
            )}
            {result.entities.termMonths && <p>Срок: {result.entities.termMonths} мес.</p>}
            {result.fieldErrors.map((e) => (
              <p className="cc-error" key={e.field}>
                {e.message}
              </p>
            ))}
            <div className="cc-actions">
              {result.actions.map((a, i) => (
                <button className="cc-button secondary" key={i} onClick={() => apply(a)}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
