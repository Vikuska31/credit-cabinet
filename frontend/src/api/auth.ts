import { fetchApi } from './client';
import type { DemoProfile, LoginResponse } from '../types';

export async function login(loginValue: string, password: string): Promise<LoginResponse> {
  return fetchApi<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginValue, password }),
  });
}

export async function getDemoProfiles(): Promise<DemoProfile[]> {
  return fetchApi<DemoProfile[]>('/auth/demo-profiles');
}

export async function demoLogin(profileId: string): Promise<LoginResponse> {
  return fetchApi<LoginResponse>('/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}