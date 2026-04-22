import { describe, expect, it } from 'bun:test';
import {
  getSchemaRepairPlanPresentation,
  isSchemaRepairSuggestionRequired,
} from '@/lib/schema-management/presentation';

describe('schema repair presentation', () => {
  it('treats repair PR generation kinds as suggestion-required', () => {
    expect(isSchemaRepairSuggestionRequired('repair_pr_required')).toBe(true);
    expect(isSchemaRepairSuggestionRequired('adopt_current_db')).toBe(true);
    expect(isSchemaRepairSuggestionRequired('manual_investigation')).toBe(false);
  });

  it('prefers merged review state over stale atlas queue state', () => {
    const presentation = getSchemaRepairPlanPresentation({
      kind: 'repair_pr_required',
      status: 'review_opened',
      reviewState: 'merged',
      reviewUrl: 'https://example.com/review/1',
      atlasExecutionStatus: 'queued',
      errorMessage: null,
    });

    expect(presentation.badgeLabel).toBe('已合并');
    expect(presentation.summary).toContain('等待发布或重新检查');
  });

  it('prefers applied status over stale atlas execution state', () => {
    const presentation = getSchemaRepairPlanPresentation({
      kind: 'repair_pr_required',
      status: 'applied',
      reviewState: 'merged',
      reviewUrl: 'https://example.com/review/1',
      atlasExecutionStatus: 'running',
      errorMessage: null,
    });

    expect(presentation.badgeLabel).toBe('已应用');
    expect(presentation.summary).toContain('修复链路已经完成');
  });

  it('keeps queued label for draft repair generation', () => {
    const presentation = getSchemaRepairPlanPresentation({
      kind: 'repair_pr_required',
      status: 'draft',
      reviewState: 'unknown',
      reviewUrl: null,
      atlasExecutionStatus: 'queued',
      errorMessage: null,
    });

    expect(presentation.badgeLabel).toBe('处理中');
    expect(presentation.summary).toBe('排队中');
  });

  it('shows repair review created state before merge', () => {
    const presentation = getSchemaRepairPlanPresentation({
      kind: 'repair_pr_required',
      status: 'review_opened',
      reviewState: 'open',
      reviewUrl: 'https://example.com/review/2',
      atlasExecutionStatus: 'succeeded',
      errorMessage: null,
    });

    expect(presentation.badgeLabel).toBe('已创建修复');
    expect(presentation.summary).toContain('等待合并');
  });
});
