import { fetchApi, type FieldError } from './client';
import type { LoanGoal } from '../types';
export type QuestionCode =
  | 'SPECIFY_BUSINESS_USE'
  | 'SPECIFY_PURPOSE'
  | 'SPECIFY_AMOUNT'
  | 'SPECIFY_TERM'
  | 'SPECIFY_CURRENCY'
  | 'EXCLUDE_PERSONAL_PURPOSE'
  | 'SELECT_APPLICATION'
  | 'SELECT_DOCUMENT';
export interface GoalResponse {
  status: 'CLASSIFIED' | 'NEEDS_CLARIFICATION' | 'NON_BUSINESS' | 'UNSUPPORTED' | 'UNAVAILABLE';
  goals: LoanGoal[];
  questionCode: QuestionCode | null;
  clarifyingQuestion: string | null;
  fallbackReason: string | null;
}
export interface AiAction {
  type:
    | 'START_SELECTION'
    | 'CONTINUE_DRAFT'
    | 'OPEN_APPLICATION'
    | 'SHOW_DOCUMENT'
    | 'EXPLAIN_TERMS';
  label: string;
  requiresConfirmation: true;
  applicationId?: string | null;
  documentId?: string | null;
  topic?: string | null;
}
export interface AssistantResponse {
  status: string;
  intent: string;
  entities: {
    purposeText: string | null;
    goals: LoanGoal[];
    amount: string | null;
    currency: string | null;
    termMonths: number | null;
  };
  questionCode: QuestionCode | null;
  clarifyingQuestion: string | null;
  reply: string;
  fallbackReason: string | null;
  actions: AiAction[];
  fieldErrors: FieldError[];
}
export const capabilities = () =>
  fetchApi<{ enabled: boolean; features: { goalClassification: boolean; assistant: boolean } }>(
    '/api/ai/capabilities',
  );
export const classify = (
  text: string,
  clarifications: { questionCode: QuestionCode; answer: string }[],
  signal: AbortSignal,
) =>
  fetchApi<GoalResponse>('/api/ai/goals/classify', {
    method: 'POST',
    signal,
    body: JSON.stringify({ text, clarifications }),
  });
export const askAssistant = (
  message: string,
  context: { screen: string; applicationId: string | null; documentId: string | null },
  history: { role: 'user' | 'assistant'; content: string }[],
) =>
  fetchApi<AssistantResponse>('/api/ai/assistant', {
    method: 'POST',
    body: JSON.stringify({ message, context, history }),
  });
