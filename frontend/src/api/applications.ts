import type { Application } from '../types';
import { fetchApi } from './client';

/** GET /api/applications → список заявок текущего клиента. */
export async function getApplications(): Promise<Application[]> {
  const data = await fetchApi<Application[] | { items?: Application[] }>('/api/applications');
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}
