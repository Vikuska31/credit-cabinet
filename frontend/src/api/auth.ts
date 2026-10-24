import { fetchApi } from './client';
import type { UserProfile } from '../types';

interface LoginResponse {
  token: string;
  user: UserProfile;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return fetchApi<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}