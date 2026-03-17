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
        setSaveMsg('Saved');
        setTeam((t) => (t ? { ...t, name } : t));
      } else {
        const data = await res.json();
        setSaveMsg(`Error: ${data.error}`);
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
    <div className="space-y-8 max-w-lg">
      {/* General */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium">General</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">
              Team name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
              disabled={!isOwner}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Slug</Label>
            <Input value={team.slug} className="h-9 text-muted-foreground" disabled />
            <p className="text-xs text-muted-foreground">Slug cannot be changed.</p>
          </div>
          {isOwner && (
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                size="sm"
                className="h-8"
                disabled={saving || name === team.name}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save changes'}
              </Button>
              {saveMsg && (
                <span
                  className={`text-xs ${saveMsg.startsWith('Error') ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {saveMsg}
                </span>
              )}
            </div>
          )}
        </form>
      </section>

      {/* Danger zone — owner only */}
      {isOwner && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
          <div className="rounded-lg border border-destructive/30 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Delete this team</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently deletes the team, all projects, and deployments. This cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-8 shrink-0">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &ldquo;{team.name}&rdquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the team and all associated projects and
                    deployments. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Delete team'
                    )}
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
