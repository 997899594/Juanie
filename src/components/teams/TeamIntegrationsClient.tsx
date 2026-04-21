'use client';

import { Loader2, RefreshCw, ShieldAlert, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import {
  fetchTeamIntegrationsSnapshot,
  revokeTeamIntegration,
  setDefaultTeamIntegration,
} from '@/lib/teams/client-actions';
import type { getTeamIntegrationsPageData } from '@/lib/teams/service';

interface TeamIntegrationsClientProps {
  teamId: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getTeamIntegrationsPageData>>>;
}

function toBadgeVariant(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  switch (tone) {
    case 'success':
      return 'success' as const;
    case 'warning':
      return 'warning' as const;
    case 'danger':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
}

export function TeamIntegrationsClient({ teamId, initialData }: TeamIntegrationsClientProps) {
  const [overview, setOverview] = useState(initialData.overview);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingBindingId, setPendingBindingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      const snapshot = await fetchTeamIntegrationsSnapshot(teamId);
      setOverview(snapshot);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '刷新团队集成失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSetDefault = async (bindingId: string) => {
    setPendingBindingId(bindingId);
    setMessage(null);
    try {
      await setDefaultTeamIntegration({ teamId, bindingId });
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '设置默认绑定失败');
    } finally {
      setPendingBindingId(null);
    }
  };

  const handleRevoke = async (bindingId: string) => {
    setPendingBindingId(bindingId);
    setMessage(null);
    try {
      await revokeTeamIntegration({ teamId, bindingId });
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '撤销绑定失败');
    } finally {
      setPendingBindingId(null);
    }
  };
  const shellClassName =
    'rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]';

  return (
    <div className="space-y-6">
      <PageHeader
        title="集成"
        actions={
          <Button
            variant="ghost"
            className="h-9 rounded-full px-4"
            onClick={refreshData}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            刷新
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {overview.stats.map((stat) => (
          <div key={stat.label} className={`${shellClassName} px-5 py-4`}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {overview.bindings.length === 0 ? (
          <div className={`${shellClassName} px-5 py-8 text-center text-sm text-muted-foreground`}>
            暂无集成
          </div>
        ) : (
          overview.bindings.map((binding) => {
            const isPending = pendingBindingId === binding.id;

            return (
              <div key={binding.id} className={`${shellClassName} px-5 py-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold">{binding.label}</div>
                      <Badge variant="secondary">{binding.provider}</Badge>
                      <Badge variant="secondary">{binding.authModeLabel}</Badge>
                      {binding.isDefault ? <Badge variant="success">默认</Badge> : null}
                      {binding.isRevoked ? <Badge variant="secondary">已撤销</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      执行身份：{binding.identityOwner}
                      {binding.revokedAtLabel ? ` · 撤销时间：${binding.revokedAtLabel}` : ''}
                    </div>
                  </div>

                  {overview.canManage && !binding.isRevoked ? (
                    <div className="flex flex-wrap gap-2">
                      {!binding.isDefault ? (
                        <Button
                          variant="ghost"
                          className="h-8 rounded-full px-3"
                          onClick={() => handleSetDefault(binding.id)}
                          disabled={isPending}
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                          设为默认
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        className="h-8 rounded-full px-3 text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(binding.id)}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        撤销
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  {binding.statusTone === 'success' ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <Badge variant={toBadgeVariant(binding.statusTone)}>
                    {binding.statusSummary}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </div>

      {message ? <div className="text-xs text-destructive">{message}</div> : null}
    </div>
  );
}
