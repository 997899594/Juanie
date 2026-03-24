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
import { PageHeader } from '@/components/ui/page-header';
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
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-20 animate-pulse rounded-[20px] bg-muted" />
        <div className="h-80 animate-pulse rounded-[20px] bg-muted" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="console-panel flex min-h-72 items-center justify-center text-muted-foreground">
          项目不存在
        </div>
      </div>
    );
  }

  const canEdit = ['owner', 'admin'].includes(project.yourRole);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="设置" description="项目配置" />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="h-11 rounded-[18px] bg-secondary/70 p-1">
          <TabsTrigger value="general" className="rounded-xl px-4">
            常规
          </TabsTrigger>
          <TabsTrigger value="git" className="rounded-xl px-4">
            Git
          </TabsTrigger>
          <TabsTrigger value="danger" className="rounded-xl px-4">
            危险操作
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">常规</div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">项目名称</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-11 rounded-xl"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="h-11 rounded-xl"
                  disabled={!canEdit}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="console-card bg-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    团队
                  </div>
                  <div className="mt-2 text-sm font-medium">{project.teamName}</div>
                </div>
                <div className="console-card bg-secondary/20 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    状态
                  </div>
                  <div className="mt-2 text-sm font-medium capitalize">{project.status}</div>
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" className="rounded-xl" disabled={saving}>
                    {saving ? '保存中...' : '保存修改'}
                  </Button>
                  {saved && <span className="text-xs text-success">已保存</span>}
                </div>
              )}
            </form>
          </div>
        </TabsContent>

        <TabsContent value="git">
          <div className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">代码仓库</div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="gitRepository">仓库地址</Label>
                <Input
                  id="gitRepository"
                  placeholder="https://github.com/owner/repo"
                  value={formData.gitRepository}
                  onChange={(e) => setFormData({ ...formData, gitRepository: e.target.value })}
                  className="h-11 rounded-xl"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gitBranch">分支</Label>
                <Input
                  id="gitBranch"
                  value={formData.gitBranch}
                  onChange={(e) => setFormData({ ...formData, gitBranch: e.target.value })}
                  className="h-11 rounded-xl"
                  disabled={!canEdit}
                />
              </div>

              {canEdit && (
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" className="rounded-xl" disabled={saving}>
                    {saving ? '保存中...' : '保存修改'}
                  </Button>
                  {saved && <span className="text-xs text-success">已保存</span>}
                </div>
              )}
            </form>
          </div>
        </TabsContent>

        <TabsContent value="danger">
          <div className="overflow-hidden rounded-[20px] border border-destructive/40 bg-background">
            <div className="border-b border-destructive/30 px-5 py-4">
              <div className="text-sm font-semibold text-destructive">危险操作</div>
            </div>
            <div className="px-5 py-4">
              {project.yourRole === 'owner' ? (
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-medium">删除项目</div>
                    <div className="mt-1 text-sm text-muted-foreground">该操作无法撤销。</div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="rounded-xl">
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除项目</AlertDialogTitle>
                        <AlertDialogDescription>
                          确认删除 “{project.name}”？该操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">只有项目拥有者可以删除项目。</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
