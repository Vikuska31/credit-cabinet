import { useEffect, useRef, useState } from 'react';
import { capabilities, classify, type GoalResponse, type QuestionCode } from '../../api/ai';
import { fetchApi } from '../../api/client';
import type { GoalInfo, LoanGoal } from '../../types';
import { aiUnavailableMessage } from '../../utils/ai';
interface Props {
  text: string;
  onText: (text: string) => void;
  onConfirm: (goals: LoanGoal[]) => void;
  catalog: GoalInfo[];
}
export default function OtherGoalInput({ text, onText, onConfirm, catalog }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [result, setResult] = useState<GoalResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [turns, setTurns] = useState<{ questionCode: QuestionCode; answer: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    capabilities()
      .then((c) => setEnabled(c.features.goalClassification))
      .catch(() => setEnabled(false));
    return () => controller.current?.abort();
  }, []);
  const analyze = async () => {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setNote('');
    setResult(null);
    const next =
      result?.questionCode && answer.trim()
        ? [...turns, { questionCode: result.questionCode, answer: answer.trim() }]
        : turns;
    try {
      const r = await classify(text, next, active.signal);
      if (!active.signal.aborted) {
        setResult(r);
        setTurns(next);
        setAnswer('');
      }
    } catch (e) {
      if (!active.signal.aborted) setNote(e instanceof Error ? e.message : 'Помощник недоступен');
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  };
  const change = (v: string) => {
    controller.current?.abort();
    setBusy(false);
    setResult(null);
    setTurns([]);
    setAnswer('');
    setNote('');
    onText(v);
  };
  const inquire = async () => {
    setBusy(true);
    try {
      await fetchApi('/api/goal-inquiries', { method: 'POST', body: JSON.stringify({ text }) });
      setNote('Вопрос передан сотруднику. Ответ появится в разделе «Заявки».');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cc-other" aria-busy={busy}>
      <label>
        Опишите бизнес-задачу
        <textarea value={text} maxLength={4000} onChange={(e) => change(e.target.value)} />
      </label>
      {enabled ? (
        <button
          type="button"
          className="cc-button secondary"
          disabled={busy || !text.trim() || turns.length >= 3}
          onClick={() => void analyze()}
        >
          {busy ? 'Обрабатываем…' : 'Определить категории'}
        </button>
      ) : (
        <p>Выберите конкретные категории вручную или передайте вопрос сотруднику.</p>
      )}
      {result?.status === 'CLASSIFIED' && (
        <div className="cc-notice">
          <p>
            Предлагаемые категории:{' '}
            {result.goals.map((g) => catalog.find((c) => c.code === g)?.title || g).join(', ')}
          </p>
          <button type="button" className="cc-button" onClick={() => onConfirm(result.goals)}>
            Подтвердить категории
          </button>
        </div>
      )}
      {result?.status === 'NEEDS_CLARIFICATION' && (
        <label>
          {result.clarifyingQuestion}
          <input value={answer} maxLength={4000} onChange={(e) => setAnswer(e.target.value)} />
        </label>
      )}
      {result?.status === 'NON_BUSINESS' && (
        <p role="status">Эта цель относится к личным расходам. Укажите задачу бизнеса.</p>
      )}
      {result?.status === 'UNAVAILABLE' && (
        <p role="status">{aiUnavailableMessage(result.fallbackReason)}</p>
      )}
      {result?.status === 'UNSUPPORTED' && (
        <p role="status">
          Эта бизнес-цель не входит в доступные категории. Уточните описание или обратитесь к
          сотруднику.
        </p>
      )}
      {note && <p role="status">{note}</p>}
      <button
        type="button"
        className="cc-link"
        disabled={busy || !text.trim()}
        onClick={() => void inquire()}
      >
        Передать вопрос сотруднику
      </button>
    </div>
  );
}
