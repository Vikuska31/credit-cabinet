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
export type LoanGoal = 'GOODS' | 'ADVERTISING' | 'EXPENSES' | 'EQUIPMENT' | 'REPAIR' | 'OTHER';
export interface UserProfile {
  id: string;
  role: 'CLIENT' | 'EMPLOYEE';
  firstName?: string;
  fullName: string;
  companyName: string;
  inn: string;
}
export interface LoginResponse {
  token: string;
  role: string;
  fullName: string;
  companyInn: string | null;
}
export interface Principal {
  login: string;
  fullName: string;
  role: string;
  companyInn: string | null;
}
export interface CompanyProfile {
  userFullName: string;
  company: { inn: string; name: string };
  dataUpdatedAt: string | null;
  note: string;
}
export interface DemoProfile {
  id: string;
  title: string;
  login: string;
  companyName: string;
}
export interface GoalInfo {
  code: LoanGoal;
  title: string;
  hint: string;
}
export interface Tariff {
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  annualRatePercent: number;
  upfrontFeePercent: number;
}
export interface LoanOffer {
  kind: 'REQUESTED' | 'LOWER_PAYMENT' | 'BANK_COUNTER';
  amount: number;
  termMonths: number;
  annualRatePercent: number;
  monthlyPayment: number;
  totalInterest: number;
  upfrontFee: number;
  totalPayout: number;
}
export interface DocumentRef {
  id: string;
  type: string;
  title: string;
  periodFrom: string | null;
  periodTo: string | null;
  version: number;
  uploadedAt: string;
}
export interface DocumentCheck {
  type: string;
  blocksSubmit: boolean;
  reason: string;
  attached: DocumentRef | null;
  suggested: DocumentRef | null;
}
export interface Application {
  id: string;
  number: number;
  companyInn: string;
  status: ApplicationStatus;
  statusTitle: string;
  step: number;
  goals: LoanGoal[];
  otherGoalText: string | null;
  otherGoalCategory: LoanGoal | null;
  amount: number | null;
  termMonths: number | null;
  selectedKind: LoanOffer['kind'];
  monthlyIncomeRub: number | null;
  monthlyExpensesRub: number | null;
  attachedDocumentIds: string[];
  consent: boolean;
  submittedOffer: LoanOffer | null;
  submittedAt: string | null;
  finalOffer: LoanOffer | null;
  issuedAt: string | null;
  decision: {
    outcome: string;
    reasons: { code: string; text: string }[];
    changes: { field: string; requested: string; offered: string }[];
  } | null;
  openRequests: { field: string; documentType: string | null; message: string }[];
  history: { at: string; actor: string; type: string; message: string }[];
  // Удобные поля, которые бэкенд добавляет для списков
  product?: string;
  months?: number | null;
  purpose?: string;
  createdAt?: string;
  updatedAt?: string;
}
export type DraftUpdate = Partial<
  Pick<
    Application,
    | 'goals'
    | 'otherGoalText'
    | 'otherGoalCategory'
    | 'amount'
    | 'termMonths'
    | 'selectedKind'
    | 'monthlyIncomeRub'
    | 'monthlyExpensesRub'
    | 'attachedDocumentIds'
    | 'consent'
    | 'step'
  >
>;
export interface Selection {
  goals: LoanGoal[];
  otherGoalText?: string;
  amount: number;
  termMonths: number;
}
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Черновик',
  UNDER_REVIEW: 'На рассмотрении',
  NEEDS_CLARIFICATION: 'Нужны уточнения',
  CHECK_FAILED: 'Проверка не завершена',
  APPROVED: 'Одобрено',
  COUNTER_OFFERED: 'Другие условия',
  REJECTED: 'Отказ',
  DECLINED_BY_CLIENT: 'Клиент отказался',
  ISSUED: 'Оформлен — демо',
};
export const FINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  'REJECTED',
  'DECLINED_BY_CLIENT',
  'ISSUED',
];
