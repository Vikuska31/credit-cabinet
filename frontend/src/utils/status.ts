import { FINAL_APPLICATION_STATUSES, type ApplicationStatus } from '../types';

export type StatusTone = 'red' | 'green' | 'purple' | 'blue' | 'gray';

export const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  DRAFT: 'purple',
  UNDER_REVIEW: 'blue',
  NEEDS_CLARIFICATION: 'red',
  CHECK_FAILED: 'red',
  APPROVED: 'green',
  COUNTER_OFFERED: 'red',
  REJECTED: 'gray',
  DECLINED_BY_CLIENT: 'gray',
  ISSUED: 'green',
};

export const isFinalStatus = (status: ApplicationStatus): boolean =>
  FINAL_APPLICATION_STATUSES.includes(status);