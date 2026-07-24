import type { DeliveryExecutionStatus } from '@/lib/db/schema';

const terminalStatuses = new Set<DeliveryExecutionStatus>([
  'production_verified',
  'historical',
  'failed',
  'canceled',
]);

const allowedTransitions = {
  received: ['dispatching', 'failed', 'canceled'],
  dispatching: ['building', 'failed', 'canceled'],
  building: [
    'staging_releasing',
    'production_releasing',
    'production_verified',
    'failed',
    'canceled',
  ],
  staging_releasing: ['staging_verified', 'failed', 'canceled'],
  staging_verified: ['awaiting_promotion', 'production_releasing', 'failed', 'canceled'],
  awaiting_promotion: ['production_releasing', 'failed', 'canceled'],
  production_releasing: ['production_verified', 'failed', 'canceled'],
  production_verified: [],
  historical: [],
  failed: [],
  canceled: [],
} as const satisfies Record<DeliveryExecutionStatus, readonly DeliveryExecutionStatus[]>;

export function isDeliveryExecutionTerminal(status: DeliveryExecutionStatus): boolean {
  return terminalStatuses.has(status);
}

export function assertDeliveryExecutionTransition(
  current: DeliveryExecutionStatus,
  next: DeliveryExecutionStatus
): void {
  if (current === next) return;
  if (!(allowedTransitions[current] as readonly DeliveryExecutionStatus[]).includes(next)) {
    throw new Error(`Delivery execution cannot move from ${current} to ${next}`);
  }
}
