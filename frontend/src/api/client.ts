const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'credit-cabinet:token';
export interface FieldError {
  field: string;
  message: string;
}
export class ApiError extends Error {
  status: number;
  fieldErrors: FieldError[];
  constructor(status: number, message: string, fields: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fields;
  }
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch(BASE_URL + endpoint, { ...options, headers });
  const text = await response.text();
  if (!response.ok) {
    let message = 'Ошибка ' + response.status;
    let fields: FieldError[] = [];
    try {
      const data = JSON.parse(text);
      message = data.message || message;
      fields = data.fieldErrors || [];
    } catch {
      /* Non-JSON error. */
    }
    if (response.status === 401) {
      setToken(null);
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new ApiError(response.status, message, fields);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
export async function downloadDocument(id: string) {
  const r = await fetch(BASE_URL + '/api/documents/' + encodeURIComponent(id) + '/file', {
    headers: { Authorization: 'Bearer ' + (getToken() || '') },
  });
  if (!r.ok) throw new ApiError(r.status, 'Не удалось скачать файл');
  const url = URL.createObjectURL(await r.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'document.pdf';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
