'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ResolvedAIPluginSnapshot } from '@/lib/ai/runtime/plugin-service';
import type { DynamicPluginOutput } from '@/lib/ai/schemas/dynamic-plugin-output';

function getSourceLabel(source: ResolvedAIPluginSnapshot['source'], stale: boolean): string {
  if (source === 'fresh') {
    return '刚生成';
  }

  if (source === 'cache') {
    return stale ? '历史快照' : '缓存快照';
  }

  return '暂无快照';
}

function getToneVariant(
  tone: DynamicPluginOutput['headline']['tone']
): 'secondary' | 'warning' | 'destructive' {
  if (tone === 'critical') {
    return 'destructive';
  }

  if (tone === 'warning') {
    return 'warning';
  }

  return 'secondary';
}

export function EnvironmentDynamicPluginPanel(input: {
  projectId: string;
  environmentId: string;
  pluginId: string;
  initialPanel: ResolvedAIPluginSnapshot<DynamicPluginOutput> | null;
}) {
  const [panel, setPanel] = useState<ResolvedAIPluginSnapshot<DynamicPluginOutput> | null>(
    input.initialPanel
  );
  const [loading, setLoading] = useState(!input.initialPanel);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
          `/api/projects/${input.projectId}/environments/${input.environmentId}/ai-plugins/${input.pluginId}`,
          { method }
        );
        const data = (await response.json().catch(() => null)) as
          | ResolvedAIPluginSnapshot<DynamicPluginOutput>
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
              ? data.error
              : '动态插件加载失败'
          );
        }

        setPanel(data as ResolvedAIPluginSnapshot<DynamicPluginOutput>);
        setActionError(null);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : '动态插件加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [input.environmentId, input.pluginId, input.projectId]
  );

  useEffect(() => {
    if (!input.initialPanel) {
      load(false);
    }
  }, [input.initialPanel, load]);

  const output = panel?.snapshot?.output ?? null;

  if (loading && !panel) {
    return (
      <section className="rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          AI 插件
        </div>
        <div className="mt-3 text-sm text-muted-foreground">正在加载插件结果…</div>
      </section>
    );
  }

  if (!panel) {
    return null;
  }

  return (
    <section className="rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,244,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_18px_40px_rgba(55,53,47,0.055)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            AI 插件
          </div>
          <div className="text-lg font-semibold tracking-[-0.03em] text-foreground">
            {panel.manifest.title}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{getSourceLabel(panel.source, panel.stale)}</Badge>
            <Badge variant="secondary">{panel.manifest.scope}</Badge>
            <Badge variant="secondary">{panel.manifest.permissions.level}</Badge>
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
          {refreshing ? '刷新中...' : '刷新插件'}
        </Button>
      </div>

      {output ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getToneVariant(output.headline.tone)}>{output.headline.tone}</Badge>
            </div>
            <div className="mt-3 text-sm font-medium text-foreground">{output.headline.title}</div>
            <div className="mt-2 text-sm text-muted-foreground">{output.headline.summary}</div>
          </div>

          {output.findings.length > 0 ? (
            <div className="space-y-2">
              {output.findings.slice(0, 4).map((finding) => (
                <div
                  key={`${finding.title}:${finding.priority}`}
                  className="rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-foreground">{finding.title}</div>
                    <Badge variant="secondary">{finding.priority}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{finding.summary}</div>
                </div>
              ))}
            </div>
          ) : null}

          {output.nextActions.length > 0 ? (
            <div className="rounded-[16px] bg-[rgba(243,240,233,0.66)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                动作建议
              </div>
              <div className="mt-3 space-y-3">
                {output.nextActions.map((action) => (
                  <div key={`${action.label}:${action.actionId ?? 'none'}`} className="space-y-2">
                    <div className="text-sm font-medium text-foreground">{action.label}</div>
                    <div className="text-sm text-muted-foreground">{action.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted-foreground">
          {panel.availability.blockedReason ?? panel.errorMessage ?? '当前没有插件输出'}
        </div>
      )}

      {actionError ? <div className="mt-4 text-sm text-destructive">{actionError}</div> : null}
    </section>
  );
}
