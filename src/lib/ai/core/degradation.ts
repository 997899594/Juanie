export type AIDegradedReason =
  | 'provider_unconfigured'
  | 'provider_unavailable'
  | 'structured_unavailable'
  | 'entitlement_blocked'
  | 'evidence_incomplete';

export interface AIDegradationState {
  degraded: boolean;
  reason: AIDegradedReason | null;
  summary: string | null;
}

export function createDegradationState(
  reason: AIDegradedReason | null,
  summary?: string | null
): AIDegradationState {
  return {
    degraded: reason !== null,
    reason,
    summary: summary ?? null,
  };
}
