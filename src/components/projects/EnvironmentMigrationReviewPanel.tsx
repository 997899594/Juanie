'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { migrationReviewManifest } from '@/lib/ai/plugins/migration-review/manifest';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { MigrationReview } from '@/lib/ai/schemas/migration-review';

function getSourceLabel(source: ResolvedAIPluginSnapshot['source'], stale: boolean): string {
  if (source === 'fresh') {
    return '刚生成';
  }

  if (source === 'cache') {
    return stale ? '历史快照' : '缓存快照';
  }

  return '暂无快照';
}

export function EnvironmentMigrationReviewPanel(input: {
  projectId: string;
  environmentId: string;
  initialPanel?: ResolvedAIPluginSnapshot<MigrationReview> | null;
}) {
  const [panel, setPanel] = useState<ResolvedAIPluginSnapshot<MigrationReview> | null>(
    input.initialPanel ?? null
  );
  const [loading, setLoading] = useState(!input.initialPanel);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (forceRefresh = false) => {
      const method = forceRefresh ? 'POST' : 'GET';

      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(
          `/api/projects/${input.projectId}/environments/${input.environmentId}/ai-migration-review`,
          { method }
        );
        const data = (await response.json().catch(() => null)) as
          | ResolvedAIPluginSnapshot<MigrationReview>
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
              ? data.error
              : '迁移审阅加载失败'
          );
        }

        setPanel(data as ResolvedAIPluginSnapshot<MigrationReview>);
      } catch (error) {
        setPanel({
          manifest: migrationReviewManifest,
          availability: {
            enabled: false,
            providerEnabled: false,
            pluginEnabled: true,
            plan: 'free',
            requiredTier: migrationReviewManifest.tier,
            blockedReason: error instanceof Error ? error.message : '迁移审阅加载失败',
          },
          snapshot: null,
          source: 'none',
          stale: false,
          providerStatus: {
            provider: '302.ai',
            configured: false,
            enabled: false,
            models: {
              chat: '',
              toolCalling: '',
              pro: '',
              json: '',
            },
          },
          errorMessage: error instanceof Error ? error.message : '迁移审阅加载失败',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [input.environmentId, input.projectId]
  );

  useEffect(() => {
    if (!input.initialPanel) {
      load(false);
    }
  }, [input.initialPanel, load]);

  const output = panel?.snapshot?.output ?? null;

  return (
    <section className="rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            迁移审阅
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {output?.headline.status ? (
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                {output.headline.status === 'healthy'
                  ? '稳定'
                  : output.headline.status === 'attention'
                    ? '需关注'
                    : '有风险'}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
              {getSourceLabel(panel?.source ?? 'none', panel?.stale ?? false)}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-full px-4"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      {loading && !panel ? (
        <div className="mt-4 text-sm text-muted-foreground">正在整理迁移状态…</div>
      ) : output ? (
        <div className="mt-5 space-y-4">
          <div>
            <div className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              {output.headline.summary}
            </div>
            {output.headline.nextAction ? (
              <div className="mt-2 text-sm text-muted-foreground">
                下一步：{output.headline.nextAction}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                迁移
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                {output.migration.summary}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {[
                  `${output.migration.totalRuns} 次运行`,
                  output.migration.awaitingApprovalCount > 0
                    ? `${output.migration.awaitingApprovalCount} 个待审批`
                    : null,
                  output.migration.awaitingExternalCount > 0
                    ? `${output.migration.awaitingExternalCount} 个待外部完成`
                    : null,
                  output.migration.failedCount > 0
                    ? `${output.migration.failedCount} 个失败`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>

            <div className="rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Schema
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                {output.schema.summary}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {[
                  `${output.schema.databaseCount} 个数据库`,
                  output.schema.blockedCount > 0 ? `${output.schema.blockedCount} 个阻塞` : null,
                  output.schema.pendingCount > 0 ? `${output.schema.pendingCount} 个待处理` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>

          <div className="rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              当前重点
            </div>
            <div className="mt-2 space-y-1.5">
              {output.focusPoints.map((point) => (
                <div key={point} className="text-sm text-foreground">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted-foreground">
          {panel?.availability.blockedReason ?? panel?.errorMessage ?? '当前还没有迁移审阅'}
        </div>
      )}
    </section>
  );
}
