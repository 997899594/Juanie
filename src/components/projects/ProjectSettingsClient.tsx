'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ProjectGovernancePanel } from '@/components/projects/ProjectGovernancePanel';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateEnvironmentStrategy } from '@/lib/environments/client-actions';
import type { ProjectGovernanceSnapshot } from '@/lib/projects/settings-view';

interface ProjectSettingsClientProps {
  projectId: string;
  initialData: {
    project: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      repositoryFullName: string | null;
      repositoryWebUrl: string | null;
      productionBranch: string;
      status: string;
      teamName: string;
      teamSlug: string;
      yourRole: string;
      governance: ProjectGovernanceSnapshot;
      environments: Array<{
        id: string;
        name: string;
        isProduction: boolean;
        isPreview: boolean;
        deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green';
        databaseStrategy: 'direct' | 'inherit' | 'isolated_clone';
        actions: {
          canConfigureStrategy: boolean;
          configureStrategySummary: string;
        };
      }>;
    };
    overview: {
      headerDescription: string;
      stats: Array<{
        label: string;
        value: string;
      }>;
    };
  };
}

const deploymentStrategyOptions = [
  { value: 'rolling', label: '滚动发布' },
  { value: 'controlled', label: '受控放量' },
  { value: 'canary', label: '金丝雀' },
  { value: 'blue_green', label: '蓝绿切换' },
] as const;

const databaseStrategyLabels: Record<'direct' | 'inherit' | 'isolated_clone', string> = {
  direct: '直接使用环境数据库',
  inherit: '继承基础环境数据库',
  isolated_clone: '独立预览库',
};

export function ProjectSettingsClient({ projectId, initialData }: ProjectSettingsClientProps) {
  const router = useRouter();
  const [project, setProject] = useState(initialData.project);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingEnvironmentId, setSavingEnvironmentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: initialData.project.name || '',
    description: initialData.project.description || '',
    productionBranch: initialData.project.productionBranch || 'main',
  });

  const canEdit = ['owner', 'admin'].includes(project.yourRole);

  const handleEnvironmentStrategyChange = async (
    environmentId: string,
    deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green'
  ) => {
    setSavingEnvironmentId(environmentId);

    try {
      await updateEnvironmentStrategy({
        projectId,
        environmentId,
        deploymentStrategy,
      });

      setProject((prev) => ({
        ...prev,
        environments: prev.environments.map((environment) =>
          environment.id === environmentId ? { ...environment, deploymentStrategy } : environment
        ),
      }));
    } finally {
      setSavingEnvironmentId(null);
    }
  };

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
        setProject((prev) => ({
          ...prev,
          ...data,
        }));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/projects/${projectId}/settings`, {
      method: 'DELETE',
    });

    if (res.ok) {
      router.push('/projects');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="设置" description={initialData.overview.headerDescription} />

      <div className="grid gap-3 md:grid-cols-3">
        {initialData.overview.stats.map((stat) => (
          <div key={stat.label} className="console-panel px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-3 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="h-11 rounded-[18px] bg-secondary/70 p-1">
          <TabsTrigger value="general" className="rounded-xl px-4">
            常规
          </TabsTrigger>
          <TabsTrigger value="git" className="rounded-xl px-4">
            Git
          </TabsTrigger>
          <TabsTrigger value="environments" className="rounded-xl px-4">
            环境
          </TabsTrigger>
          <TabsTrigger value="governance" className="rounded-xl px-4">
            治理
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
                <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
                  {project.repositoryFullName ?? '未绑定仓库'}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productionBranch">生产分支</Label>
                <Input
                  id="productionBranch"
                  value={formData.productionBranch}
                  onChange={(e) => setFormData({ ...formData, productionBranch: e.target.value })}
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

        <TabsContent value="environments">
          <div className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">环境策略</div>
            </div>
            <div className="space-y-3 px-5 py-4">
              {project.environments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-sm text-muted-foreground">
                  当前项目还没有环境。
                </div>
              ) : (
                project.environments.map((environment) => (
                  <div
                    key={environment.id}
                    className="rounded-2xl border border-border bg-secondary/20 px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold">{environment.name}</div>
                          {environment.isProduction && (
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground">
                              生产
                            </span>
                          )}
                          {environment.isPreview && (
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground">
                              预览
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {environment.actions.configureStrategySummary}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          数据库策略：{databaseStrategyLabels[environment.databaseStrategy]}
                        </div>
                      </div>

                      <div className="w-full md:w-56">
                        <Label className="mb-2 block">发布策略</Label>
                        <Select
                          value={environment.deploymentStrategy}
                          onValueChange={(value) =>
                            handleEnvironmentStrategyChange(
                              environment.id,
                              value as 'rolling' | 'controlled' | 'canary' | 'blue_green'
                            )
                          }
                          disabled={
                            savingEnvironmentId === environment.id ||
                            !environment.actions.canConfigureStrategy
                          }
                        >
                          <SelectTrigger className="h-11 rounded-xl bg-background">
                            <SelectValue placeholder="选择发布策略" />
                          </SelectTrigger>
                          <SelectContent>
                            {deploymentStrategyOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="governance">
          <div className="console-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold">治理</div>
            </div>
            <div className="px-5 py-4">
              <ProjectGovernancePanel governance={project.governance} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="danger">
          <div className="overflow-hidden rounded-[20px] border border-destructive/40 bg-background">
            <div className="border-b border-destructive/30 px-5 py-4">
              <div className="text-sm font-semibold text-destructive">危险操作</div>
            </div>
            <div className="px-5 py-4">
              {project.yourRole === 'owner' ? (
                <div className="flex flex-col gap-4 rounded-[24px] border border-destructive/20 bg-destructive/[0.03] p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">删除项目</div>
                    <div className="text-sm text-muted-foreground">
                      这会移除项目记录、环境配置和关联的发布视图。该操作无法撤销。
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full rounded-xl md:w-auto">
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除项目</AlertDialogTitle>
                        <AlertDialogDescription>
                          确认删除{' '}
                          <span className="font-medium text-foreground">{project.name}</span>
                          ？该操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                        删除后，项目主页、环境设置、发布记录入口都会被移除。若你只是想停止发布，应该优先调整环境或治理策略，而不是删项目。
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="w-full rounded-xl sm:w-auto">
                          取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="w-full rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
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
