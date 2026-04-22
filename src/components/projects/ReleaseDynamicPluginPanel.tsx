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

export function ReleaseDynamicPluginPanel(input: {
  projectId: string;
  releaseId: string;
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
          `/api/projects/${input.projectId}/releases/${input.releaseId}/ai-plugins/${input.pluginId}`,
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
    [input.pluginId, input.projectId, input.releaseId]
  );

  useEffect(() => {
    if (!input.initialPanel) {
      load(false);
    }
  }, [input.initialPanel, load]);

  const output = panel?.snapshot?.output ?? null;

  if (loading && !panel) {
    return (
      <div className="rounded-[20px] bg-[rgba(243,240,233,0.7)] px-4 py-5 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset]">
        <div className="text-sm font-medium text-foreground">正在加载插件结果…</div>
      </div>
    );
  }

  if (!panel) {
    return null;
  }

  return (
    <div className="rounded-[20px] bg-[rgba(243,240,233,0.7)] px-4 py-5 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">{panel.manifest.title}</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{getSourceLabel(panel.source, panel.stale)}</Badge>
            <Badge variant="secondary">{panel.manifest.permissions.level}</Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-full px-4"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {output ? (
        <div className="mt-4 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getToneVariant(output.headline.tone)}>{output.headline.tone}</Badge>
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">{output.headline.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{output.headline.summary}</div>
          </div>

          {output.findings.slice(0, 3).map((finding) => (
            <div key={`${finding.title}:${finding.priority}`}>
              <div className="text-sm font-medium text-foreground">{finding.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{finding.summary}</div>
            </div>
          ))}

          {output.nextActions.length > 0 ? (
            <div className="space-y-3">
              {output.nextActions.map((action) => (
                <div key={`${action.label}:${action.actionId ?? 'none'}`} className="space-y-2">
                  <div className="text-sm font-medium text-foreground">{action.label}</div>
                  <div className="text-sm text-muted-foreground">{action.summary}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">
          {panel.availability.blockedReason ?? panel.errorMessage ?? '当前没有插件输出'}
        </div>
      )}

      {actionError ? <div className="mt-3 text-sm text-destructive">{actionError}</div> : null}
    </div>
  );
}
