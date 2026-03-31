'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TeamGovernancePanel } from '@/components/teams/TeamGovernancePanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { deleteTeam, updateTeamAISettings, updateTeamSettings } from '@/lib/teams/client-actions';
import type { getTeamSettingsPageData } from '@/lib/teams/service';

interface TeamSettingsClientProps {
  teamId: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getTeamSettingsPageData>>>;
}

export function TeamSettingsClient({ teamId, initialData }: TeamSettingsClientProps) {
  const router = useRouter();
  const [team, setTeam] = useState(initialData.team);
  const [name, setName] = useState(initialData.team.name);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [aiPlan, setAiPlan] = useState(initialData.aiControlPlane.plan);
  const [aiPlugins, setAiPlugins] = useState(initialData.aiControlPlane.plugins);
  const [savingAI, setSavingAI] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const overview = initialData.overview;
  const aiControlPlane = initialData.aiControlPlane;
  const aiActivity = initialData.aiActivity;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);

    try {
      await updateTeamSettings({ teamId, name });
      setSaveMsg('已保存');
      setTeam((prev) => ({ ...prev, name }));
    } catch (error) {
      setSaveMsg(`错误：${error instanceof Error ? error.message : '保存失败'}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTeam(teamId);
      router.push('/teams');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAI(true);
    setAiMessage(null);

    try {
      const updated = await updateTeamAISettings({
        teamId,
        plan: aiPlan,
        plugins: aiPlugins.map((plugin) => ({
          pluginId: plugin.id,
          enabled: plugin.enabled,
        })),
      });

      setAiPlan(updated.plan);
      setAiPlugins((prev) =>
        prev.map((plugin) => ({
          ...plugin,
          enabled: updated.plugins.find((item) => item.id === plugin.id)?.enabled ?? plugin.enabled,
        }))
      );
      setAiMessage('AI 控制面已保存');
    } catch (error) {
      setAiMessage(`错误：${error instanceof Error ? error.message : '保存失败'}`);
    } finally {
      setSavingAI(false);
      setTimeout(() => setAiMessage(null), 3000);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="设置"
        description={overview.headerDescription}
        actions={
          overview.canEdit ? (
            <Button
              type="submit"
              form="team-settings-form"
              className="h-9 rounded-xl px-4"
              disabled={saving || name === team.name}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {overview.stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <form id="team-settings-form" onSubmit={handleSave} className="console-panel px-5 py-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              团队名称
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
              disabled={!overview.canEdit}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">标识</Label>
            <Input value={team.slug} className="h-11 rounded-xl text-muted-foreground" disabled />
          </div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">{overview.saveSummary}</div>
        {saveMsg && (
          <div
            className={`mt-4 text-xs ${saveMsg.startsWith('错误') ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {saveMsg}
          </div>
        )}
      </form>

      <section className="console-panel px-5 py-5">
        <div className="text-sm font-semibold">治理</div>
        <div className="mt-4">
          <TeamGovernancePanel governance={overview.governance} />
        </div>
      </section>

      <form onSubmit={handleSaveAI} className="console-panel px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">AI Control Plane</div>
            <div className="mt-1 text-xs text-muted-foreground">{aiControlPlane.summary}</div>
          </div>
          {overview.canEdit ? (
            <Button type="submit" className="h-9 rounded-xl px-4" disabled={savingAI}>
              {savingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存 AI 配置'}
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4 rounded-[24px] border border-border bg-secondary/20 p-4">
            <div className="space-y-2">
              <Label className="text-sm">团队套餐</Label>
              <Select
                value={aiPlan}
                onValueChange={(value) =>
                  setAiPlan(value as 'free' | 'pro' | 'scale' | 'enterprise')
                }
                disabled={!overview.canEdit}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="scale">Scale</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Provider
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium">{aiControlPlane.provider.provider}</div>
                <Badge
                  variant={
                    aiControlPlane.provider.enabled
                      ? 'success'
                      : aiControlPlane.provider.configured
                        ? 'warning'
                        : 'outline'
                  }
                >
                  {aiControlPlane.provider.enabled
                    ? '已启用'
                    : aiControlPlane.provider.configured
                      ? '已配置未启用'
                      : '未配置'}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                默认模型：{aiControlPlane.provider.models.pro}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {aiPlugins.map((plugin) => (
              <div
                key={plugin.id}
                className="rounded-[24px] border border-border bg-background px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold">{plugin.name}</div>
                      <Badge variant="outline">{plugin.tierLabel}</Badge>
                      <Badge variant="outline">{plugin.surfaceLabel}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      schema：{plugin.snapshotSchema} · 缓存{' '}
                      {Math.round(plugin.cacheTtlSeconds / 60)} 分钟
                      {plugin.supportsManualRefresh ? ' · 支持手动刷新' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      {plugin.enabled ? '已启用' : '已关闭'}
                    </div>
                    <Switch
                      checked={plugin.enabled}
                      disabled={!overview.canEdit}
                      onCheckedChange={(checked) =>
                        setAiPlugins((prev) =>
                          prev.map((item) =>
                            item.id === plugin.id ? { ...item, enabled: checked } : item
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {aiMessage && (
          <div
            className={`mt-4 text-xs ${aiMessage.startsWith('错误') ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {aiMessage}
          </div>
        )}
      </form>

      <section className="console-panel px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">最近 AI 活动</div>
            <div className="mt-1 text-xs text-muted-foreground">
              只展示控制面变更和手动刷新，避免把 AI 面板做成第二个审计中心。
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {aiActivity.length > 0 ? (
            aiActivity.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-[24px] border border-border bg-background px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.summary}</div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {item.actorLabel} · {item.createdAtLabel}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-border bg-secondary/20 px-4 py-5 text-sm text-muted-foreground">
              还没有 AI 配置或手动刷新记录。
            </div>
          )}
        </div>
      </section>

      <section className="console-panel border-destructive/20 px-5 py-5">
        <div className="flex flex-col gap-4 rounded-[24px] border border-destructive/20 bg-destructive/[0.03] p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-destructive">删除团队</div>
            <div className="text-xs text-muted-foreground">
              会永久删除团队和所有关联项目。这个动作无法恢复。
            </div>
          </div>
          {overview.canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="h-9 w-full shrink-0 rounded-xl px-4 md:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  删除团队
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除 &ldquo;{team.name}&rdquo;？</AlertDialogTitle>
                  <AlertDialogDescription>
                    这会永久删除团队及其关联项目和部署，且无法恢复。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                  如果你只是想限制访问，优先考虑调整成员和治理策略。删除团队会直接移除该团队下的全部项目视图。
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="w-full rounded-xl sm:w-auto">
                    取消
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : '删除团队'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="text-xs text-muted-foreground">只有 owner 可以删除团队。</div>
          )}
        </div>
      </section>
    </div>
  );
}
