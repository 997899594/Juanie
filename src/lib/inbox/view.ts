import type { ApprovalStat } from '@/lib/approvals/view';
import type { AttentionFilterState } from '@/lib/migrations/attention';

export type InboxFilterState = AttentionFilterState | 'schema';

export interface InboxStatsInput {
  migrationTotal: number;
  approval: number;
  external: number;
  failed: number;
  schema: number;
  schemaBlocking: number;
}

export function buildInboxFilterHref(state: InboxFilterState): string {
  return state === 'all' ? '/inbox' : `/inbox?state=${state}`;
}

export function normalizeInboxFilterState(state?: string): InboxFilterState {
  if (state === 'approval' || state === 'failed' || state === 'schema') {
    return state;
  }

  return 'all';
}

export function buildInboxStats(input: InboxStatsInput): ApprovalStat[] {
  return [
    { label: '全部', value: input.migrationTotal + input.schema },
    { label: '迁移待办', value: input.migrationTotal },
    { label: '数据库状态', value: input.schema },
    { label: '需要我处理', value: input.approval + input.schemaBlocking },
  ];
}
