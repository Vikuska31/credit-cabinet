import { FINAL_APPLICATION_STATUSES, type ApplicationStatus } from '../types';

export type StatusTone = 'red' | 'green' | 'purple' | 'blue' | 'gray';

/** Цвет тега для каждого статуса заявки. */
export const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  draft: 'purple',
  processing: 'blue',
  review: 'blue',
  'needs-info': 'purple',
  counter: 'purple',
  approved: 'green',
  rejected: 'red',
  declined: 'gray',
  accepted: 'green',
  signed: 'green',
  issued: 'green',
};

export const isFinalStatus = (status: ApplicationStatus): boolean =>
  FINAL_APPLICATION_STATUSES.includes(status);