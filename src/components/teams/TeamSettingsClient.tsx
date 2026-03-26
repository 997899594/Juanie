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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { deleteTeam, updateTeamSettings } from '@/lib/teams/client-actions';
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

  const overview = initialData.overview;

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

      <section className="console-panel border-destructive/20 px-5 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-destructive">删除团队</div>
            <div className="mt-1 text-xs text-muted-foreground">会永久删除团队和所有关联项目。</div>
          </div>
          {overview.canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="h-9 shrink-0 rounded-xl px-4">
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
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
