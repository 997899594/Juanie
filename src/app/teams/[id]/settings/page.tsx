'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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

interface TeamInfo {
  id: string;
  name: string;
  slug: string;
  yourRole: string;
}

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/teams/${teamId}`)
      .then((r) => r.json())
      .then((data: TeamInfo) => {
        setTeam(data);
        setName(data.name);
      });
  }, [teamId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setSaveMsg('已保存');
        setTeam((t) => (t ? { ...t, name } : t));
      } else {
        const data = await res.json();
        setSaveMsg(`错误：${data.error}`);
      }
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/teams');
      }
    } finally {
      setDeleting(false);
    }
  };

  if (!team) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isOwner = team.yourRole === 'owner';

  return (
    <div className="space-y-6">
      <PageHeader
        title="设置"
        description={isOwner ? '拥有者权限' : '只读'}
        actions={
          isOwner ? (
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

      <form
        id="team-settings-form"
        onSubmit={handleSave}
        className="console-panel max-w-3xl px-5 py-5"
      >
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
              disabled={!isOwner}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">标识</Label>
            <Input value={team.slug} className="h-11 rounded-xl text-muted-foreground" disabled />
          </div>
        </div>
        {saveMsg && (
          <div
            className={`mt-4 text-xs ${saveMsg.startsWith('错误') ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {saveMsg}
          </div>
        )}
      </form>

      {isOwner && (
        <section className="console-panel max-w-3xl border-destructive/20 px-5 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-destructive">删除团队</div>
              <div className="mt-1 text-xs text-muted-foreground">
                会永久删除团队和所有关联项目。
              </div>
            </div>
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
          </div>
        </section>
      )}
    </div>
  );
}
