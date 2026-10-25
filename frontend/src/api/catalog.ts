import type { GoalInfo, LoanOffer, Selection, Tariff, DocumentRef } from '../types';
import { fetchApi } from './client';
export const getGoals = () => fetchApi<GoalInfo[]>('/api/goals');
export const getTariff = () => fetchApi<Tariff>('/api/tariff');
export const preview = (s: Selection) =>
  fetchApi<{ hints: string[]; offers: LoanOffer[]; disclaimer: string }>('/api/offers/preview', {
    method: 'POST',
    body: JSON.stringify({
      goals: s.goals.filter((g) => g !== 'OTHER'),
      amount: s.amount,
      termMonths: s.termMonths,
    }),
  });
export const getDocuments = () => fetchApi<DocumentRef[]>('/api/documents');
export const uploadDocument = (body: FormData) =>
  fetchApi<DocumentRef>('/api/documents', { method: 'POST', body });
