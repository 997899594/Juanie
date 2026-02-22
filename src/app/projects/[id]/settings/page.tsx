'use client';

import { Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProjectSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  gitRepository: string | null;
  gitBranch: string;
  status: string;
  teamName: string;
  teamSlug: string;
  yourRole: string;
}

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gitRepository: '',
    gitBranch: 'main',
  });

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setFormData({
          name: data.name || '',
          description: data.description || '',
          gitRepository: data.gitRepository || '',
          gitBranch: data.gitBranch || 'main',
        });
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error('Failed to update project:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/projects');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const canEdit = ['owner', 'admin'].includes(project.yourRole);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your project settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="h-9">
          <TabsTrigger value="general" className="text-sm">
            General
          </TabsTrigger>
          <TabsTrigger value="git" className="text-sm">
            Git
          </TabsTrigger>
          <TabsTrigger value="danger" className="text-sm">
            Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h2 className="font-medium text-sm">General Settings</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm">
                  Project Name
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm">
                  Description
                </Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="h-9"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Team</Label>
                <p className="text-sm text-muted-foreground">{project.teamName}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Status</Label>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      project.status === 'active'
                        ? 'bg-success'
                        : project.status === 'initializing'
                          ? 'bg-warning'
                          : 'bg-muted-foreground'
                    }`}
                  />
                  <span className="text-sm text-muted-foreground capitalize">{project.status}</span>
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" size="sm" className="h-8" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  {saved && <span className="text-xs text-success">Saved</span>}
                </div>
              )}
            </form>
          </div>
        </TabsContent>

        <TabsContent value="git">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h2 className="font-medium text-sm">Git Settings</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gitRepository" className="text-sm">
                  Repository URL
                </Label>
                <Input
                  id="gitRepository"
                  placeholder="https://github.com/owner/repo"
                  value={formData.gitRepository}
                  onChange={(e) => setFormData({ ...formData, gitRepository: e.target.value })}
                  className="h-9"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gitBranch" className="text-sm">
                  Branch
                </Label>
                <Input
                  id="gitBranch"
                  value={formData.gitBranch}
                  onChange={(e) => setFormData({ ...formData, gitBranch: e.target.value })}
                  className="h-9"
                  disabled={!canEdit}
                />
              </div>

              {canEdit && (
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" size="sm" className="h-8" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  {saved && <span className="text-xs text-success">Saved</span>}
                </div>
              )}
            </form>
          </div>
        </TabsContent>

        <TabsContent value="danger">
          <div className="rounded-lg border border-destructive/50 bg-card">
            <div className="p-4 border-b border-destructive/50">
              <h2 className="font-medium text-sm text-destructive">Danger Zone</h2>
            </div>
            <div className="p-4">
              {project.yourRole === 'owner' ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Delete Project</p>
                    <p className="text-xs text-muted-foreground">
                      Once deleted, there is no going back
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="h-8">
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{project.name}"? This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Only the project owner can delete this project.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
