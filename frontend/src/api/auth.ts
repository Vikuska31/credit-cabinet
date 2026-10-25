import { fetchApi } from './client';
import type { CompanyProfile, DemoProfile, LoginResponse, Principal } from '../types';
export const login = (login: string, password: string) =>
  fetchApi<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
export const demoLogin = (profileId: string) =>
  fetchApi<LoginResponse>('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
export const getDemoProfiles = () => fetchApi<DemoProfile[]>('/api/auth/demo-profiles');
export const getMe = () => fetchApi<Principal>('/api/me');
export const getProfile = () => fetchApi<CompanyProfile>('/api/profile');
export const endSession = () => fetchApi<void>('/api/auth/logout', { method: 'POST' });
export const staffLogin = (login: string, password: string) =>
  fetchApi<LoginResponse>('/api/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
