import type {
  AtlasExecutionStatus,
  EnvironmentSchemaStateStatus,
  SchemaRepairPlanStatus,
  SchemaRepairReviewState,
} from '@/lib/db/schema';

export function getEnvironmentSchemaStateLabel(
  status: EnvironmentSchemaStateStatus | null | undefined
): string {
  switch (status) {
    case 'aligned':
      return '已对齐';
    case 'pending_migrations':
      return '待执行迁移';
    case 'aligned_untracked':
      return '账本缺失';
    case 'drifted':
      return '已漂移';
    case 'unmanaged':
      return '未纳管';
    case 'blocked':
      return '检查失败';
    default:
      return '未检查';
  }
}

export interface SchemaRepairPlanPresentationInput {
  kind: string | null | undefined;
  status: SchemaRepairPlanStatus | null | undefined;
  reviewState: SchemaRepairReviewState | null | undefined;
  reviewUrl?: string | null;
  atlasExecutionStatus: AtlasExecutionStatus | null | undefined;
  errorMessage?: string | null;
}

export interface SchemaRepairPlanPresentation {
  badgeLabel: string;
  summary: string | null;
}

export function isSchemaRepairSuggestionRequired(kind: string | null | undefined): boolean {
  return kind === 'repair_pr_required' || kind === 'adopt_current_db';
}

export function getSchemaRepairPlanPresentation(
  plan: SchemaRepairPlanPresentationInput,
  options?: {
    hasGeneratedDiff?: boolean;
  }
): SchemaRepairPlanPresentation {
  if (plan.status === 'applied') {
    return {
      badgeLabel: '已应用',
      summary: '修复链路已经完成，当前等待正常发布继续推进。',
    };
  }

  if (plan.status === 'superseded') {
    return {
      badgeLabel: '已替换',
      summary: '当前计划已被更新的修复方案替代。',
    };
  }

  if (plan.reviewState === 'closed') {
    return {
      badgeLabel: '已关闭',
      summary: plan.errorMessage ?? '修复评审单已关闭，未继续推进。',
    };
  }

  if (plan.status === 'review_opened' && plan.reviewState === 'merged') {
    return {
      badgeLabel: '已合并',
      summary: '修复 PR 已合并，等待发布或重新检查数据库状态。',
    };
  }

  if (plan.status === 'review_opened') {
    return {
      badgeLabel: plan.kind === 'manual_investigation' ? '已创建排查 PR' : '已创建修复',
      summary:
        plan.reviewState === 'draft'
          ? '评审单已创建，等待提交或打开。'
          : '评审单已创建，等待合并。',
    };
  }

  if (plan.kind === 'manual_investigation') {
    return {
      badgeLabel: plan.reviewUrl ? '已转排查 PR' : '待人工排查',
      summary: plan.reviewUrl
        ? '排查 PR 已生成，等待人工处理。'
        : (plan.errorMessage ?? '需要先人工排查，再决定后续修复方式。'),
    };
  }

  if (!isSchemaRepairSuggestionRequired(plan.kind)) {
    switch (plan.kind) {
      case 'no_action':
        return {
          badgeLabel: '无需处理',
          summary: '当前数据库已经对齐，无需额外修复动作。',
        };
      case 'run_release_migrations':
        return {
          badgeLabel: '正常发布',
          summary: '按正常发布流程执行迁移即可补齐。',
        };
      case 'mark_aligned':
        return {
          badgeLabel: '待补账本',
          summary: '确认结构无误后，执行标记对齐补写账本。',
        };
      default:
        return {
          badgeLabel: '无需处理',
          summary: null,
        };
    }
  }

  switch (plan.atlasExecutionStatus) {
    case 'queued':
      return {
        badgeLabel: '处理中',
        summary: '排队中',
      };
    case 'running':
      return {
        badgeLabel: '处理中',
        summary: '生成中',
      };
    case 'succeeded':
      return {
        badgeLabel: '已生成',
        summary: options?.hasGeneratedDiff
          ? '已生成，等待创建修复 PR。'
          : '等待确认并创建修复 PR。',
      };
    case 'failed':
      return {
        badgeLabel: '失败',
        summary: plan.errorMessage ?? '执行失败',
      };
    default:
      return {
        badgeLabel: '待生成',
        summary: '待生成',
      };
  }
}
