export type ApplicationStatus =
  | 'draft'
  | 'processing'
  | 'review'
  | 'needs-info'
  | 'counter'
  | 'approved'
  | 'rejected'
  | 'declined'
  | 'accepted'
  | 'signed'
  | 'issued';

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
  createdAt?: string;
  updatedAt?: string;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Черновик',
  processing: 'На рассмотрении',
  review: 'На проверке',
  'needs-info': 'Нужны сведения',
  counter: 'Другие условия',
  approved: 'Одобрено',
  rejected: 'Отказ',
  declined: 'Отклонено клиентом',
  accepted: 'Условия приняты',
  signed: 'Подписано',
  issued: 'Выдано',
};

export const FINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  'rejected',
  'declined',
  'issued',
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