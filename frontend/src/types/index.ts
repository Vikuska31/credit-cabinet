export type ApplicationStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'NEEDS_CLARIFICATION'
  | 'CHECK_FAILED'
  | 'APPROVED'
  | 'COUNTER_OFFERED'
  | 'REJECTED'
  | 'DECLINED_BY_CLIENT'
  | 'ISSUED';

export interface UserProfile {
  id: string;
  firstName?: string;
  fullName?: string;
  companyName?: string;
  inn?: string;
}

export interface Application {
  id: string;
  product: string;
  amount: number;
  months: number;
  status: ApplicationStatus;
  purpose?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Черновик',
  UNDER_REVIEW: 'На рассмотрении',
  NEEDS_CLARIFICATION: 'Нужны уточнения',
  CHECK_FAILED: 'Ошибка проверки',
  APPROVED: 'Одобрено',
  COUNTER_OFFERED: 'Встречное предложение',
  REJECTED: 'Отказ',
  DECLINED_BY_CLIENT: 'Отклонено клиентом',
  ISSUED: 'Выдано',
};

export const FINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  'REJECTED',
  'DECLINED_BY_CLIENT',
  'ISSUED',
];

export interface Product {
  id: string;
  name: string;
  description: string;
  minAmount: number;
  maxAmount: number;
  minMonths: number;
  maxMonths: number;
  rate: number;
}

export interface DemoProfile {
  id: string;
  title: string;
  login: string;
  companyName: string;
}

export interface LoginResponse {
  token: string;
  role?: string;
  fullName?: string;
  companyInn?: string;
  user?: UserProfile;
}