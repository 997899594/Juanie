'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { environmentSummaryManifest } from '@/lib/ai/plugins/environment-summary/manifest';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { EnvironmentSummary } from '@/lib/ai/schemas/environment-summary';

function getSourceLabel(source: ResolvedAIPluginSnapshot['source'], stale: boolean): string {
  if (source === 'fresh') {
    return '最新';
  }

  if (source === 'cache') {
    return stale ? '历史' : '缓存';
  }

  return '无结果';
}

export function EnvironmentAISummaryPanel(input: {
  projectId: string;
  environmentId: string;
  initialPanel?: ResolvedAIPluginSnapshot<EnvironmentSummary> | null;
}) {
  const [panel, setPanel] = useState<ResolvedAIPluginSnapshot<EnvironmentSummary> | null>(
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
          `/api/projects/${input.projectId}/environments/${input.environmentId}/ai-summary`,
          {
            method,
          }
        );
        const data = (await response.json().catch(() => null)) as
          | ResolvedAIPluginSnapshot<EnvironmentSummary>
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
              ? data.error
              : 'AI 摘要加载失败'
          );
        }

        setPanel(data as ResolvedAIPluginSnapshot<EnvironmentSummary>);
      } catch (error) {
        setPanel({
          manifest: environmentSummaryManifest,
          availability: {
            enabled: false,
            providerEnabled: false,
            pluginEnabled: true,
            plan: 'free',
            requiredTier: 'free',
            blockedReason: error instanceof Error ? error.message : 'AI 摘要加载失败',
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
          errorMessage: error instanceof Error ? error.message : 'AI 摘要加载失败',
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

  if (loading && !panel) {
    return (
      <section className="rounded-[24px] bg-[rgba(251,250,247,0.96)] px-5 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.05)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
          摘要
        </div>
        <div className="mt-3 text-sm text-[rgba(15,23,42,0.48)]">分析中…</div>
      </section>
    );
  }

  const output = panel?.snapshot?.output ?? null;

  return (
    <section className="rounded-[24px] bg-[rgba(251,250,247,0.96)] px-5 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
            摘要
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {output?.headline.status ? (
              <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] px-3 py-1 text-[11px] font-medium text-[rgba(15,23,42,0.62)] shadow-none">
                {output.headline.status === 'healthy'
                  ? '稳定'
                  : output.headline.status === 'attention'
                    ? '需关注'
                    : '有风险'}
              </Badge>
            ) : null}
            <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.06)] px-3 py-1 text-[11px] font-medium text-[rgba(15,23,42,0.62)] shadow-none">
              {getSourceLabel(panel?.source ?? 'none', panel?.stale ?? false)}
            </Badge>
            {panel?.errorMessage ? (
              <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.05)] px-3 py-1 text-[11px] font-medium text-[rgba(15,23,42,0.48)] shadow-none">
                异常
              </Badge>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full bg-[rgba(15,23,42,0.04)] px-3.5 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {refreshing ? '刷新中…' : '刷新'}
        </Button>
      </div>

      {output ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div>
              <div className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                {output.headline.summary}
              </div>
              {output.headline.nextAction ? (
                <div className="mt-2 text-sm text-[rgba(15,23,42,0.56)]">
                  {output.headline.nextAction}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] bg-[rgba(15,23,42,0.03)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                  来源
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {output.sourceOfTruth.sourceLabel ?? '未标注来源'}
                </div>
                {output.sourceOfTruth.gitSummary ? (
                  <div className="mt-1 text-sm text-[rgba(15,23,42,0.56)]">
                    {output.sourceOfTruth.gitSummary}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[18px] bg-[rgba(15,23,42,0.03)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                  结论
                </div>
                <div className="mt-2 text-sm text-foreground">{output.operatorNarrative}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[18px] bg-[rgba(15,23,42,0.03)] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                资源
              </div>
              <div className="mt-2 text-sm text-foreground">{output.resources.databaseSummary}</div>
              <div className="mt-1 text-sm text-[rgba(15,23,42,0.56)]">
                {output.resources.variableSummary}
              </div>
            </div>

            <div className="rounded-[18px] bg-[rgba(15,23,42,0.03)] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                重点
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
        </div>
      ) : (
        <div className="mt-4 text-sm text-[rgba(15,23,42,0.48)]">
          {panel?.availability.blockedReason ?? panel?.errorMessage ?? '暂无结果'}
        </div>
      )}
    </section>
  );
}
