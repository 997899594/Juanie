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
import { useProjectsRealtime } from '@/hooks/useProjectsRealtime';
import { updateEnvironmentStrategy } from '@/lib/environments/client-actions';
import type { ProjectGovernanceSnapshot } from '@/lib/projects/settings-view';
import { formatRuntimeStatusLabel } from '@/lib/runtime/status-presentation';
import { cn } from '@/lib/utils';

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

const settingsPanelClassName =
  'rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,243,0.92))] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_16px_34px_rgba(55,53,47,0.05)]';
const settingsSubtleClassName =
  'rounded-[18px] bg-[rgba(243,240,233,0.66)] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]';

export function ProjectSettingsClient({ projectId, initialData }: ProjectSettingsClientProps) {
  const router = useRouter();
  const [project, setProject] = useState(initialData.project);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingEnvironmentId, setSavingEnvironmentId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: initialData.project.name || '',
    description: initialData.project.description || '',
    productionBranch: initialData.project.productionBranch || 'main',
  });
  const isDeleting = project.status === 'deleting';
  const overviewStats = [
    { label: '团队', value: project.teamName },
    { label: '角色', value: project.governance.roleLabel },
    { label: '状态', value: formatRuntimeStatusLabel(project.status) },
  ];

  const canEdit = ['owner', 'admin'].includes(project.yourRole) && !isDeleting;

  useProjectsRealtime({
    projectIds: [projectId],
    onEvent: (event) => {
      if (event.kind === 'project_deleted') {
        router.replace('/projects');
        router.refresh();
        return;
      }

      setProject((current) => ({
        ...current,
        status: event.project.status ?? current.status,
      }));
    },
  });

  const handleEnvironmentStrategyChange = async (
    environmentId: string,
    deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green'
  ) => {
    if (isDeleting) {
      return;
    }

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
    if (isDeleting) {
      return;
    }

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
    setDeleteError(null);
    setDeleting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'DELETE',
      });
      const payload = await res.json().catch(() => null);

      if (res.ok) {
        setProject((current) => ({
          ...current,
          status: payload?.status ?? 'deleting',
        }));
        return;
      }

      setDeleteError(payload?.error ?? '删除项目失败，请稍后再试');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="设置"
        description={
          isDeleting ? '项目正在删除中，环境资源清理完成后会自动从列表移除。' : undefined
        }
      />

      <div className="grid gap-2 md:grid-cols-3">
        {overviewStats.map((stat) => (
          <div key={stat.label} className={settingsSubtleClassName}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-2 truncate text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="h-11">
          <TabsTrigger value="general">常规</TabsTrigger>
          <TabsTrigger value="git">Git</TabsTrigger>
          <TabsTrigger value="environments">环境</TabsTrigger>
          <TabsTrigger value="governance">治理</TabsTrigger>
          <TabsTrigger value="danger">危险操作</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className={cn(settingsPanelClassName, 'overflow-hidden')}>
            <div className="console-divider-bottom px-5 py-4">
              <div className="text-sm font-semibold">常规</div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">项目名称</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className={settingsSubtleClassName}>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    团队
                  </div>
                  <div className="mt-2 text-sm font-medium">{project.teamName}</div>
                </div>
                <div className={settingsSubtleClassName}>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    状态
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {formatRuntimeStatusLabel(project.status)}
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={saving || isDeleting}>
                    {saving ? '保存中...' : '保存'}
                  </Button>
                  {saved && <span className="text-xs text-success">已保存</span>}
                </div>
              )}
            </form>
          </div>
        </TabsContent>

        <TabsContent value="git">
          <div className={cn(settingsPanelClassName, 'overflow-hidden')}>
            <div className="console-divider-bottom px-5 py-4">
              <div className="text-sm font-semibold">代码仓库</div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="gitRepository">仓库地址</Label>
                <div
                  className={cn(settingsSubtleClassName, 'break-all text-sm text-muted-foreground')}
                >
                  {project.repositoryFullName ?? '未绑定仓库'}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productionBranch">生产分支</Label>
                <Input
                  id="productionBranch"
                  value={formData.productionBranch}
                  onChange={(e) => setFormData({ ...formData, productionBranch: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              {canEdit && (
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={saving || isDeleting}>
                    {saving ? '保存中...' : '保存修改'}
                  </Button>
                  {saved && <span className="text-xs text-success">已保存</span>}
                </div>
              )}
            </form>
          </div>
        </TabsContent>

        <TabsContent value="environments">
          <div className={cn(settingsPanelClassName, 'overflow-hidden')}>
            <div className="console-divider-bottom px-5 py-4">
              <div className="text-sm font-semibold">环境策略</div>
            </div>
            <div className="space-y-3 px-5 py-4">
              {project.environments.length === 0 ? (
                <div className={cn(settingsSubtleClassName, 'py-6 text-sm text-muted-foreground')}>
                  没有环境。
                </div>
              ) : (
                project.environments.map((environment) => (
                  <div key={environment.id} className={cn(settingsSubtleClassName, 'px-4 py-4')}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold">{environment.name}</div>
                          {environment.isProduction && (
                            <span className="rounded-full bg-white/84 px-2.5 py-1 text-[11px] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(17,17,17,0.04)]">
                              生产
                            </span>
                          )}
                          {environment.isPreview && (
                            <span className="rounded-full bg-white/84 px-2.5 py-1 text-[11px] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(17,17,17,0.04)]">
                              预览
                            </span>
                          )}
                        </div>
                        <div className="break-words text-sm text-muted-foreground">
                          {environment.actions.configureStrategySummary}
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
                            isDeleting ||
                            !environment.actions.canConfigureStrategy
                          }
                        >
                          <SelectTrigger>
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
                        <div className="mt-2 text-xs text-muted-foreground">
                          {databaseStrategyLabels[environment.databaseStrategy]}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="governance">
          <div className={cn(settingsPanelClassName, 'overflow-hidden')}>
            <div className="console-divider-bottom px-5 py-4">
              <div className="text-sm font-semibold">治理</div>
            </div>
            <div className="console-divider-bottom px-5 py-4">
              <ProjectGovernancePanel governance={project.governance} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="danger">
          <div className={cn(settingsPanelClassName, 'overflow-hidden')}>
            <div className="px-5 py-4">
              <div className="text-sm font-semibold text-destructive">危险操作</div>
            </div>
            <div className="px-5 py-4">
              {project.yourRole === 'owner' ? (
                <>
                  <div className="rounded-[22px] bg-[linear-gradient(180deg,rgba(196,85,77,0.08),rgba(255,255,255,0.92))] p-4 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_0_0_1px_rgba(196,85,77,0.08)] sm:p-5 md:flex md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-foreground">删除项目</div>
                      <div className="text-sm text-muted-foreground">
                        {isDeleting ? '正在清理项目资源，请稍候。' : '该操作无法撤销。'}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full md:w-auto"
                          disabled={isDeleting || deleting}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? '删除中' : deleting ? '提交中...' : '删除'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent size="form">
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除项目</AlertDialogTitle>
                          <AlertDialogDescription>
                            确认删除{' '}
                            <span className="font-medium text-foreground">{project.name}</span>？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="rounded-[20px] bg-[rgba(196,85,77,0.06)] px-4 py-3 text-sm text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.64)_inset]">
                          {isDeleting
                            ? '删除任务已经提交，项目、环境和发布记录会在清理完成后一起移除。'
                            : '项目、环境和发布记录会一起删除。'}
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="w-full rounded-full sm:w-auto">
                            取消
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting || deleting}
                            className="w-full rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                          >
                            {isDeleting ? '删除中' : deleting ? '提交中...' : '删除'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {deleteError ? (
                    <p className="mt-3 text-sm text-destructive">{deleteError}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">仅 owner 可删除。</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
