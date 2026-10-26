import type { Application, DocumentCheck, DraftUpdate } from '../types';
import { fetchApi } from './client';
const path = (id: string) => '/api/applications/' + encodeURIComponent(id);
export const getApplications = () => fetchApi<Application[]>('/api/applications');
export const getApplication = (id: string) => fetchApi<Application>(path(id));
export const createDraft = () => fetchApi<Application>('/api/applications', { method: 'POST' });
export const updateDraft = (id: string, patch: DraftUpdate) =>
  fetchApi<Application>(path(id), { method: 'PATCH', body: JSON.stringify(patch) });
export const getChecks = (id: string) => fetchApi<DocumentCheck[]>(path(id) + '/documents');
export const applicationAction = (
  id: string,
  action:
    | 'submit'
    | 'accept'
    | 'decline'
    | 'retry-check'
    | 'documents/attach-suggested'
    | 'clarification-response',
  body?: object,
) =>
  fetchApi<Application>(path(id) + '/' + action, {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
