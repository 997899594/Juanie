import type { IntegrationAuthMode } from '@/lib/db/schema';
import {
  listTeamIntegrationBindingSummaries,
  revokeTeamIntegrationBinding,
} from '@/lib/integrations/service/team-binding-service';

export interface MemberRemovalBindingSummary {
  id: string;
  authMode: IntegrationAuthMode;
  isDefault: boolean;
  sourceUserId: string;
  revokedAt?: Date | null;
}

export interface MemberRemovalImpact {
  blocking: boolean;
  blockingReason: string | null;
  autoRevokeBindingIds: string[];
}

const BLOCKING_REASON =
  '该成员持有团队默认个人绑定。请先设置其他默认绑定（建议服务账号）后再移除。';

export function evaluateMemberRemovalImpact(input: {
  bindingSummaries: MemberRemovalBindingSummary[];
  targetUserId: string;
}): MemberRemovalImpact {
  const activeBindings = input.bindingSummaries.filter((binding) => !binding.revokedAt);
  const isDefaultPersonalOwnedByTarget = activeBindings.some(
    (binding) =>
      binding.authMode === 'personal' &&
      binding.isDefault &&
      binding.sourceUserId === input.targetUserId
  );

  if (isDefaultPersonalOwnedByTarget) {
    return {
      blocking: true,
      blockingReason: BLOCKING_REASON,
      autoRevokeBindingIds: [],
    };
  }

  const autoRevokeBindingIds = activeBindings
    .filter(
      (binding) =>
        binding.authMode === 'personal' &&
        !binding.isDefault &&
        binding.sourceUserId === input.targetUserId
    )
    .map((binding) => binding.id);

  return {
    blocking: false,
    blockingReason: null,
    autoRevokeBindingIds,
  };
}

export async function applyMemberRemovalSafeguards(input: {
  teamId: string;
  targetUserId: string;
}): Promise<MemberRemovalImpact> {
  const bindingSummaries = await listTeamIntegrationBindingSummaries(input.teamId);
  const impact = evaluateMemberRemovalImpact({
    bindingSummaries,
    targetUserId: input.targetUserId,
  });

  if (impact.blocking || impact.autoRevokeBindingIds.length === 0) {
    return impact;
  }

  await Promise.all(
    impact.autoRevokeBindingIds.map((bindingId) =>
      revokeTeamIntegrationBinding(input.teamId, bindingId)
    )
  );

  return impact;
}
