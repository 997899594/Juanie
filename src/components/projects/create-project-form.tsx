'use client';

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  GitBranch,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface DetectedService {
  name: string;
  type: 'web' | 'worker' | 'cron';
  appDir: string;
  startCommand: string;
  port: number;
}

interface ServiceWithId extends DetectedService {
  _id: string;
}

interface DatabaseWithId {
  _id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  plan: 'starter' | 'standard' | 'premium';
  provisionType: 'shared' | 'standalone' | 'external';
  externalUrl?: string;
}

interface CreateProjectFormProps {
  teams: Array<{ id: string; name: string; slug: string }>;
}

type CreateMode = 'import' | 'create';
type Step = 'mode' | 'repository' | 'config' | 'review';

interface FormData {
  mode: CreateMode;
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  isPrivate: boolean;
  template: string;
  name: string;
  slug: string;
  description: string;
  teamId: string;
  services: ServiceWithId[];
  databases: DatabaseWithId[];
  domain: string;
  useCustomDomain: boolean;
  productionBranch: string;
  autoDeploy: boolean;
  // 检测结果
  monorepoType: string;
  hasDockerBake: boolean;
  bakeTargets: string[];
}

const STEPS: { id: Step; title: string }[] = [
  { id: 'mode', title: '模式' },
  { id: 'repository', title: '仓库' },
  { id: 'config', title: '配置' },
  { id: 'review', title: '确认' },
];

const TEMPLATES = [
  {
    id: 'nextjs',
    name: 'Next.js',
    description: '支持 SSR 的 React 框架',
    language: 'TypeScript',
  },
  { id: 'express', name: 'Express', description: 'Node.js REST API', language: 'TypeScript' },
  { id: 'fastapi', name: 'FastAPI', description: 'Python Web 框架', language: 'Python' },
  { id: 'go', name: 'Go API', description: 'Go REST API', language: 'Go' },
  { id: 'blank', name: 'Blank', description: '从空白项目开始', language: 'Docker' },
];

export function CreateProjectForm({ teams }: CreateProjectFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('mode');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAnalyze, setIsLoadingAnalyze] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    mode: 'import',
    repositoryId: '',
    repositoryName: '',
    repositoryFullName: '',
    isPrivate: false,
    template: 'nextjs',
    name: '',
    slug: '',
    description: '',
    teamId: teams[0]?.id || '',
    services: [],
    databases: [],
    domain: '',
    useCustomDomain: false,
    productionBranch: 'main',
    autoDeploy: true,
    monorepoType: 'none',
    hasDockerBake: false,
    bakeTargets: [],
  });

  const [repositories, setRepositories] = useState<
    Array<{
      id: string;
      fullName: string;
      name: string;
      defaultBranch: string;
    }>
  >([]);
  const [searchQuery, setSearchQuery] = useState('');

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const fetchRepositories = useCallback(
    async (search?: string) => {
      const url = new URL('/api/git/repositories', window.location.origin);
      url.searchParams.set('teamId', formData.teamId);
      if (search) url.searchParams.set('search', search);

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRepositories(data);
      }
    },
    [formData.teamId]
  );

  const analyzeRepository = useCallback(
    async (repositoryFullName: string, branch: string) => {
      setIsLoadingAnalyze(true);
      setAnalyzeError(null);

      try {
        const url = new URL('/api/git/repositories/analyze', window.location.origin);
        url.searchParams.set('repositoryFullName', repositoryFullName);
        url.searchParams.set('teamId', formData.teamId);
        url.searchParams.set('branch', branch);

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();

          // Convert detected services to form services
          const services: ServiceWithId[] = data.services.map((s: DetectedService) => ({
            _id: nanoid(),
            ...s,
          }));

          setFormData((prev) => ({
            ...prev,
            services,
            monorepoType: data.monorepoType,
            hasDockerBake: data.hasDockerBake,
            bakeTargets: data.bakeTargets,
          }));
        } else {
          const error = await res.json();
          setAnalyzeError(error.error || '分析仓库失败');
          // Set default service
          setFormData((prev) => ({
            ...prev,
            services: [
              {
                _id: nanoid(),
                name: 'web',
                type: 'web' as const,
                appDir: '.',
                startCommand: 'npm start',
                port: 3000,
              },
            ],
          }));
        }
      } catch (error) {
        console.error('Failed to analyze repository:', error);
        setAnalyzeError('分析仓库失败');
        setFormData((prev) => ({
          ...prev,
          services: [
            {
              _id: nanoid(),
              name: 'web',
              type: 'web' as const,
              appDir: '.',
              startCommand: 'npm start',
              port: 3000,
            },
          ],
        }));
      } finally {
        setIsLoadingAnalyze(false);
      }
    },
    [formData.teamId]
  );

  useEffect(() => {
    if (currentStep === 'repository' && formData.mode === 'import') {
      fetchRepositories();
    }
  }, [currentStep, formData.mode, fetchRepositories]);

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (formData.mode === 'import') {
      fetchRepositories(query);
    }
  };

  const selectRepository = async (repo: (typeof repositories)[0]) => {
    setFormData((prev) => ({
      ...prev,
      repositoryId: repo.id,
      repositoryFullName: repo.fullName,
      repositoryName: repo.name,
      name: repo.name,
      slug: repo.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      productionBranch: repo.defaultBranch || 'main',
    }));

    // 分析仓库
    await analyzeRepository(repo.fullName, repo.defaultBranch || 'main');
    handleNext();
  };

  const _updateService = (index: number, updates: Partial<DetectedService>) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    }));
  };

  const toggleService = (index: number) => {
    const service = formData.services[index];
    if ((service as ServiceWithId & { disabled?: boolean }).disabled) {
      // Re-enable: keep the service
      setFormData((prev) => ({
        ...prev,
        services: prev.services.map((s, i) => (i === index ? { ...s, disabled: false } : s)),
      }));
    } else {
      // Disable: remove from active services but keep in list
      setFormData((prev) => ({
        ...prev,
        services: prev.services.map((s, i) => (i === index ? { ...s, disabled: true } : s)),
      }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Filter out disabled services
      const activeServices = formData.services.filter(
        (s) => !(s as ServiceWithId & { disabled?: boolean }).disabled
      );

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          services: activeServices,
        }),
      });

      if (res.ok) {
        const { project } = await res.json();
        router.push(`/projects/${project.id}/initializing`);
      } else {
        const error = await res.json();
        alert(error.error || '创建项目失败');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('创建项目失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'mode':
        return true;
      case 'repository':
        if (formData.mode === 'import') {
          return !!formData.repositoryId;
        }
        return !!formData.repositoryName;
      case 'config':
        return !!formData.name && !!formData.teamId;
      case 'review': {
        const hasActiveService = formData.services.some(
          (s) => !(s as ServiceWithId & { disabled?: boolean }).disabled
        );
        const externalDbsValid = formData.databases
          .filter((db) => db.provisionType === 'external')
          .every((db) => !!db.externalUrl?.trim());
        return hasActiveService && externalDbsValid;
      }
      default:
        return false;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium',
                  index < currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground'
                )}
              >
                {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'ml-2 text-sm hidden sm:block',
                  index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.title}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-12 sm:w-20 h-0.5 mx-2',
                    index < currentStepIndex ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="console-panel px-6 py-6">
        {currentStep === 'mode' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">你想如何创建项目？</h2>
              <p className="text-sm text-muted-foreground">导入现有仓库，或从模板创建新仓库</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, mode: 'import' }))}
                className={cn(
                  'rounded-[20px] border px-5 py-5 text-left transition-colors',
                  formData.mode === 'import'
                    ? 'border-foreground bg-secondary/40'
                    : 'border-border hover:bg-secondary/40'
                )}
              >
                <div className="font-medium mb-1">导入仓库</div>
                <div className="text-sm text-muted-foreground">连接现有 Git 仓库</div>
              </button>

              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, mode: 'create' }))}
                className={cn(
                  'rounded-[20px] border px-5 py-5 text-left transition-colors',
                  formData.mode === 'create'
                    ? 'border-foreground bg-secondary/40'
                    : 'border-border hover:bg-secondary/40'
                )}
              >
                <div className="font-medium mb-1">新建仓库</div>
                <div className="text-sm text-muted-foreground">从模板创建一个新仓库</div>
              </button>
            </div>
          </div>
        )}

        {currentStep === 'repository' && (
          <div className="space-y-6">
            {formData.mode === 'import' ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">选择仓库</h2>
                  <p className="text-sm text-muted-foreground">从代码托管账号中选择一个仓库</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="搜索仓库..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-80 overflow-y-auto rounded-[20px] border border-border">
                  {repositories.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">没有找到仓库</div>
                  ) : (
                    repositories.map((repo) => (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() => selectRepository(repo)}
                        className={cn(
                          'flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-secondary/40',
                          formData.repositoryId === repo.id && 'bg-secondary/40'
                        )}
                      >
                        <div>
                          <div className="font-medium">{repo.fullName}</div>
                          <div className="text-xs text-muted-foreground">{repo.defaultBranch}</div>
                        </div>
                        {formData.repositoryId === repo.id && (
                          <Check className="h-4 w-4 text-foreground" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">新建仓库</h2>
                  <p className="text-sm text-muted-foreground">从模板创建一个新仓库</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>仓库名称</Label>
                    <Input
                      value={formData.repositoryName}
                      onChange={(e) => {
                        const name = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          repositoryName: name,
                          name,
                          slug: name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                        }));
                      }}
                      placeholder="my-awesome-project"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>可见性</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          checked={!formData.isPrivate}
                          onChange={() => setFormData((prev) => ({ ...prev, isPrivate: false }))}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">公开</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          checked={formData.isPrivate}
                          onChange={() => setFormData((prev) => ({ ...prev, isPrivate: true }))}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">私有</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>模板</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, template: template.id }))
                          }
                          className={cn(
                            'rounded-[18px] border px-4 py-4 text-left transition-colors',
                            formData.template === template.id
                              ? 'border-foreground bg-secondary/40'
                              : 'border-border hover:bg-secondary/40'
                          )}
                        >
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.language}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {currentStep === 'config' && (
          <div className="space-y-6">
            {isLoadingAnalyze ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-foreground" />
                <p className="text-sm text-muted-foreground">正在分析仓库...</p>
              </div>
            ) : analyzeError ? (
              <div className="rounded-[20px] border border-border bg-secondary/30 p-4">
                <p className="text-sm text-foreground">{analyzeError}</p>
                <p className="mt-1 text-xs text-muted-foreground">已回退到默认配置</p>
              </div>
            ) : null}

            <div>
              <h2 className="text-lg font-semibold mb-1">项目配置</h2>
              <p className="text-sm text-muted-foreground">确认项目基础设置</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>项目名称</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name,
                        slug: name
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, ''),
                      }));
                    }}
                    placeholder="my-project"
                  />
                </div>

                <div className="space-y-2">
                  <Label>标识</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="my-project"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>描述</Label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="一句简短说明"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>团队</Label>
                  <Select
                    value={formData.teamId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, teamId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择团队" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>生产分支</Label>
                  <div className="relative">
                    <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={formData.productionBranch}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, productionBranch: e.target.value }))
                      }
                      placeholder="main"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>自动部署</Label>
                    <p className="text-sm text-muted-foreground">推送到生产分支后自动部署</p>
                  </div>
                  <Switch
                    checked={formData.autoDeploy}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, autoDeploy: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">确认并创建</h2>
              <p className="text-sm text-muted-foreground">创建前再确认一次配置</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">项目名称</p>
                  <p className="font-medium">{formData.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">仓库</p>
                  <p className="font-medium">
                    {formData.mode === 'import'
                      ? formData.repositoryFullName
                      : `${formData.repositoryName}（新建）`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">团队</p>
                  <p className="font-medium">
                    {teams.find((t) => t.id === formData.teamId)?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">分支</p>
                  <p className="font-medium">{formData.productionBranch}</p>
                </div>
              </div>

              {formData.monorepoType !== 'none' && (
                <div className="flex items-center gap-2 rounded-[18px] bg-secondary/40 p-3">
                  <Badge variant="secondary">Monorepo：{formData.monorepoType}</Badge>
                  {formData.hasDockerBake && <Badge variant="secondary">docker-bake.hcl</Badge>}
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  服务（
                  {
                    formData.services.filter(
                      (s) => !(s as ServiceWithId & { disabled?: boolean }).disabled
                    ).length
                  }{' '}
                  已启用）
                </p>
                <div className="overflow-hidden rounded-[20px] border border-border">
                  {formData.services.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">没有识别到服务</div>
                  ) : (
                    formData.services.map((service, index) => (
                      <div
                        key={(service as ServiceWithId)._id}
                        className={cn(
                          'flex items-center justify-between px-4 py-4',
                          (service as ServiceWithId & { disabled?: boolean }).disabled &&
                            'opacity-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={!(service as ServiceWithId & { disabled?: boolean }).disabled}
                            onCheckedChange={() => toggleService(index)}
                          />
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {service.appDir} • {service.type} • port {service.port}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{service.type}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">
                    数据库（{formData.databases.length}）
                  </p>
                  <div className="flex gap-2">
                    {(['postgresql', 'redis', 'mysql'] as const).map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            databases: [
                              ...prev.databases,
                              {
                                _id: nanoid(),
                                name: type,
                                type,
                                plan: 'starter',
                                provisionType: 'shared',
                              },
                            ],
                          }))
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {type === 'postgresql'
                          ? 'PostgreSQL'
                          : type === 'redis'
                            ? 'Redis'
                            : 'MySQL'}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="overflow-hidden rounded-[20px] border border-border">
                  {formData.databases.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground flex flex-col items-center gap-2">
                      <Database className="h-5 w-5 opacity-40" />
                      <span className="text-sm">没有数据库，需要时可在上方添加</span>
                    </div>
                  ) : (
                    formData.databases.map((db) => {
                      const updateDb = (updates: Partial<DatabaseWithId>) =>
                        setFormData((prev) => ({
                          ...prev,
                          databases: prev.databases.map((d) =>
                            d._id === db._id ? { ...d, ...updates } : d
                          ),
                        }));
                      const sharedDisabled = db.type === 'mysql' || db.type === 'mongodb';
                      return (
                        <div key={db._id} className="space-y-2 px-4 py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <Input
                                value={db.name}
                                onChange={(e) => updateDb({ name: e.target.value })}
                                className="h-7 w-36 text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{db.type}</Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    databases: prev.databases.filter((d) => d._id !== db._id),
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          <div className="ml-7 flex items-center gap-1">
                            {(
                              [
                                { value: 'shared', label: 'Juanie 共享' },
                                { value: 'standalone', label: '独立 Pod' },
                                { value: 'external', label: '外部实例' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={opt.value === 'shared' && sharedDisabled}
                                onClick={() => updateDb({ provisionType: opt.value })}
                                className={cn(
                                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                                  db.provisionType === opt.value
                                    ? 'border-foreground bg-foreground text-background'
                                    : 'border-border bg-background hover:bg-secondary/40',
                                  opt.value === 'shared' &&
                                    sharedDisabled &&
                                    'opacity-40 cursor-not-allowed'
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {db.provisionType === 'external' && (
                            <div className="ml-7">
                              <Input
                                value={db.externalUrl || ''}
                                onChange={(e) => updateDb({ externalUrl: e.target.value })}
                                placeholder={
                                  db.type === 'redis'
                                    ? 'redis://:password@host:6379'
                                    : 'postgresql://user:pass@host:5432/db'
                                }
                                className="h-7 text-sm"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Badge variant={formData.autoDeploy ? 'default' : 'secondary'}>
                  自动部署：{formData.autoDeploy ? '开启' : '关闭'}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          className="rounded-xl px-4"
          onClick={handleBack}
          disabled={isFirstStep}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          上一步
        </Button>

        {isLastStep ? (
          <Button
            className="rounded-xl px-4"
            onClick={handleSubmit}
            disabled={!canProceed() || isSubmitting}
          >
            {isSubmitting ? '创建中...' : '创建项目'}
          </Button>
        ) : (
          <Button className="rounded-xl px-4" onClick={handleNext} disabled={!canProceed()}>
            下一步
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
