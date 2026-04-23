'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { envvarRiskManifest } from '@/lib/ai/plugins/envvar-risk/manifest';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { EnvvarRisk } from '@/lib/ai/schemas/envvar-risk';

function getSourceLabel(source: ResolvedAIPluginSnapshot['source'], stale: boolean): string {
  if (source === 'fresh') {
    return '最新';
  }

  if (source === 'cache') {
    return stale ? '历史' : '缓存';
  }

  return '无结果';
}

export function EnvironmentEnvvarRiskPanel(input: {
  projectId: string;
  environmentId: string;
  initialPanel?: ResolvedAIPluginSnapshot<EnvvarRisk> | null;
}) {
  const [panel, setPanel] = useState<ResolvedAIPluginSnapshot<EnvvarRisk> | null>(
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
          `/api/projects/${input.projectId}/environments/${input.environmentId}/ai-envvar-risk`,
          { method }
        );
        const data = (await response.json().catch(() => null)) as
          | ResolvedAIPluginSnapshot<EnvvarRisk>
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
              ? data.error
              : '变量风险加载失败'
          );
        }

        setPanel(data as ResolvedAIPluginSnapshot<EnvvarRisk>);
      } catch (error) {
        setPanel({
          manifest: envvarRiskManifest,
          availability: {
            enabled: false,
            providerEnabled: false,
            pluginEnabled: true,
            plan: 'free',
            requiredTier: envvarRiskManifest.tier,
            blockedReason: error instanceof Error ? error.message : '变量风险加载失败',
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
          errorMessage: error instanceof Error ? error.message : '变量风险加载失败',
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
    <section className="rounded-[20px] bg-[rgba(251,250,247,0.96)] px-5 py-5 shadow-[0_18px_40px_rgba(55,53,47,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            变量
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
          className="h-9 rounded-full bg-[rgba(15,23,42,0.04)] px-3.5 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      {loading && !panel ? (
        <div className="mt-4 text-sm text-muted-foreground">分析中…</div>
      ) : output ? (
        <div className="mt-5 space-y-4">
          <div>
            <div className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              {output.headline.summary}
            </div>
            {output.headline.nextAction ? (
              <div className="mt-2 text-sm text-muted-foreground">{output.headline.nextAction}</div>
            ) : null}
          </div>

          <div className="rounded-[16px] bg-[rgba(15,23,42,0.03)] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              覆盖
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {output.coverage.summary}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {[
                `${output.coverage.directCount} 个直配`,
                output.coverage.inheritedCount > 0
                  ? `${output.coverage.inheritedCount} 个继承`
                  : null,
                output.coverage.secretCount > 0 ? `${output.coverage.secretCount} 个密文` : null,
                output.coverage.serviceOverrideGroupCount > 0
                  ? `${output.coverage.serviceOverrideGroupCount} 组服务覆盖`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>

          <div className="rounded-[16px] bg-[rgba(15,23,42,0.03)] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              风险
            </div>
            <div className="mt-2 space-y-1.5">
              {output.risks.map((risk) => (
                <div key={risk} className="text-sm text-foreground">
                  {risk}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted-foreground">
          {panel?.availability.blockedReason ?? panel?.errorMessage ?? '暂无结果'}
        </div>
      )}
    </section>
  );
}
