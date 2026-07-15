import { SettlementStatus } from '@prisma/client';

export const EDITABLE_SETTLEMENT_STATUSES: SettlementStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];
export const FINALIZED_SETTLEMENT_STATUSES: SettlementStatus[] = ['LOCKED', 'PAID'];

