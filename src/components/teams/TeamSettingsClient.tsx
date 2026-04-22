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
import { cn } from '@/lib/utils';

interface TeamSettingsClientProps {
  teamId: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getTeamSettingsPageData>>>;
}

const settingsPanelClassName =
  'rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]';
const settingsSubtleClassName =
  'rounded-[18px] bg-[linear-gradient(180deg,rgba(243,240,233,0.88),rgba(255,255,255,0.9))] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_0_0_1px_rgba(17,17,17,0.035)]';

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
        actions={
          overview.canEdit ? (
            <Button
              type="submit"
              form="team-settings-form"
              className="h-9 px-4"
              disabled={saving || name === team.name}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-2 md:grid-cols-3">
        {overview.stats.map((stat) => (
          <div key={stat.label} className={settingsSubtleClassName}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-2 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <form id="team-settings-form" onSubmit={handleSave} className={settingsPanelClassName}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              团队名称
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!overview.canEdit}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">标识</Label>
            <Input value={team.slug} className="text-muted-foreground" disabled />
          </div>
        </div>
        {saveMsg && (
          <div
            className={`mt-4 rounded-full px-3 py-1.5 text-xs ${
              saveMsg.startsWith('错误')
                ? 'bg-destructive/[0.08] text-destructive'
                : 'bg-[rgba(255,255,255,0.74)] text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_6px_18px_rgba(55,53,47,0.03)]'
            }`}
          >
            {saveMsg}
          </div>
        )}
      </form>

      <section className={settingsPanelClassName}>
        <div className="text-sm font-semibold">治理</div>
        <div className="mt-4">
          <TeamGovernancePanel governance={overview.governance} />
        </div>
      </section>

      <form onSubmit={handleSaveAI} className={settingsPanelClassName}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">AI Control Plane</div>
          </div>
          {overview.canEdit ? (
            <Button type="submit" className="h-9 px-4" disabled={savingAI}>
              {savingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存 AI 配置'}
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className={cn(settingsSubtleClassName, 'space-y-4 p-4')}>
            <div className="space-y-2">
              <Label className="text-sm">团队套餐</Label>
              <Select
                value={aiPlan}
                onValueChange={(value) =>
                  setAiPlan(value as 'free' | 'pro' | 'scale' | 'enterprise')
                }
                disabled={!overview.canEdit}
              >
                <SelectTrigger>
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

            <div className={settingsSubtleClassName}>
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
                        : 'secondary'
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
                className="rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,245,240,0.9))] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_12px_26px_rgba(55,53,47,0.04)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold">{plugin.name}</div>
                      <Badge variant="secondary">{plugin.tierLabel}</Badge>
                      <Badge variant="secondary">{plugin.scopeLabel}</Badge>
                      <Badge variant="secondary">{plugin.surfaceLabel}</Badge>
                      <Badge variant="secondary">{plugin.permissionLabel}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{plugin.description}</div>
                    <div className="text-xs text-muted-foreground">
                      schema：{plugin.snapshotSchema} · 缓存{' '}
                      {Math.round(plugin.cacheTtlSeconds / 60)} 分钟
                      {plugin.supportsManualRefresh ? ' · 支持手动刷新' : ''}
                      {plugin.requiresAudit ? ' · 记录审计' : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[
                        plugin.skills.length > 0 ? `${plugin.skills.length} 个技能` : null,
                        plugin.tools.length > 0 ? `${plugin.tools.length} 个工具` : null,
                        plugin.actions.length > 0 ? `${plugin.actions.length} 个动作` : null,
                        plugin.capabilities.length > 0
                          ? `${plugin.capabilities.length} 个能力`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
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
            className={`mt-4 rounded-full px-3 py-1.5 text-xs ${
              aiMessage.startsWith('错误')
                ? 'bg-destructive/[0.08] text-destructive'
                : 'bg-[rgba(255,255,255,0.74)] text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_6px_18px_rgba(55,53,47,0.03)]'
            }`}
          >
            {aiMessage}
          </div>
        )}
      </form>

      <section className={settingsPanelClassName}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">最近 AI 活动</div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {aiActivity.length > 0 ? (
            aiActivity.map((item) => (
              <div
                key={item.id}
                className={cn(
                  settingsSubtleClassName,
                  'flex flex-col gap-2 rounded-[20px] sm:flex-row sm:items-start sm:justify-between'
                )}
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
            <div
              className={cn(
                settingsSubtleClassName,
                'rounded-[20px] py-5 text-sm text-muted-foreground'
              )}
            >
              暂无记录
            </div>
          )}
        </div>
      </section>

      <section className={settingsPanelClassName}>
        <div className="flex flex-col gap-4 rounded-[22px] bg-[linear-gradient(180deg,rgba(196,85,77,0.08),rgba(255,255,255,0.92))] p-4 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(196,85,77,0.08)] sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-destructive">删除团队</div>
            <div className="text-xs text-muted-foreground">该操作无法恢复。</div>
          </div>
          {overview.canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="h-9 w-full shrink-0 px-4 md:w-auto">
                  <Trash2 className="h-4 w-4" />
                  删除团队
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent size="form">
                <AlertDialogHeader>
                  <AlertDialogTitle>删除 &ldquo;{team.name}&rdquo;？</AlertDialogTitle>
                  <AlertDialogDescription>关联项目会一起删除。</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="ui-control-muted rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                  团队和关联项目会一起删除。
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="w-full rounded-full sm:w-auto">
                    取消
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : '删除团队'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="text-xs text-muted-foreground">仅 owner 可删除。</div>
          )}
        </div>
      </section>
    </div>
  );
}
