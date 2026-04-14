'use client';

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  GitBranch,
  Globe,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlatformSignalBlock } from '@/components/ui/platform-signals';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ServiceConfig } from '@/lib/config/parser';
import {
  getEnvironmentDatabaseStrategyLabel,
  getEnvironmentDeploymentStrategyLabel,
} from '@/lib/environments/presentation';
import { submitCreateProject } from '@/lib/projects/create-client-actions';
import {
  applyRuntimeProfileToServices,
  buildTemplateServices,
  type CreateRuntimeProfile,
  type CreateTemplateOption,
  createPreviewDatabaseStrategies,
  createProductionDeploymentStrategies,
  createRuntimeProfiles,
  getServiceRuntimeSummary,
} from '@/lib/projects/create-defaults';
import { cn } from '@/lib/utils';

interface AnalyzeServiceResponse {
  name: string;
  type: 'web' | 'worker' | 'cron';
  appDir?: string;
  startCommand?: string;
  port?: number;
  schedule?: string;
  build?: {
    command?: string;
    dockerfile?: string;
    context?: string;
  };
  run?: {
    command: string;
    port?: number;
  };
  healthcheck?: {
    path?: string;
    interval?: number;
  };
  scaling?: {
    min?: number;
    max?: number;
    cpu?: number;
  };
  resources?: {
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  };
  isPublic?: boolean;
}

interface ServiceWithId {
  _id: string;
  disabled?: boolean;
  name: string;
  type: 'web' | 'worker' | 'cron';
  appDir: string;
  schedule?: string;
  build?: {
    command?: string;
    dockerfile?: string;
    context?: string;
  };
  run: {
    command: string;
    port?: number;
  };
  healthcheck?: {
    path?: string;
    interval?: number;
  };
  scaling?: {
    min?: number;
    max?: number;
    cpu?: number;
  };
  resources?: {
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  };
  isPublic?: boolean;
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
  teamScopes: Array<{
    id: string;
    name: string;
    slug: string;
    role: 'owner' | 'admin' | 'member';
    roleLabel: string;
    providerLabels: string[];
    importEnabled: boolean;
    createEnabled: boolean;
    importSummary: string;
    createSummary: string;
    importSignals: {
      chips: Array<{ key: string; label: string; tone: 'danger' | 'neutral' }>;
      primarySummary: string | null;
      nextActionLabel: string | null;
    };
    createSignals: {
      chips: Array<{ key: string; label: string; tone: 'danger' | 'neutral' }>;
      primarySummary: string | null;
      nextActionLabel: string | null;
    };
  }>;
  templates: CreateTemplateOption[];
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
  productionDeploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green';
  previewDatabaseStrategy: 'inherit' | 'isolated_clone';
  runtimeProfile: CreateRuntimeProfile;
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

const DATABASE_TYPE_OPTIONS = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'redis', label: 'Redis' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mongodb', label: 'MongoDB' },
] as const;

const DATABASE_PLAN_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
] as const;

function withServiceIds(services: Omit<ServiceWithId, '_id'>[]): ServiceWithId[] {
  return services.map((service) => ({
    _id: nanoid(),
    ...service,
  }));
}

function normalizeService(
  service: AnalyzeServiceResponse | Omit<ServiceWithId, '_id'>,
  runtimeProfile: CreateRuntimeProfile
): Omit<ServiceWithId, '_id'> {
  const run =
    service.run ??
    ('startCommand' in service
      ? {
          command: service.startCommand ?? 'npm start',
          port: service.port,
        }
      : {
          command: 'npm start',
        });

  const normalized = {
    name: service.name,
    type: service.type,
    appDir: service.appDir ?? '.',
    schedule: service.schedule,
    build:
      service.build ??
      (service.type === 'web'
        ? {
            command: 'npm run build',
          }
        : undefined),
    run,
    healthcheck: service.healthcheck,
    scaling: service.scaling,
    resources: service.resources,
    isPublic: service.isPublic ?? service.type === 'web',
  } satisfies Omit<ServiceWithId, '_id'>;

  return applyRuntimeProfileToServices([normalized], runtimeProfile)[0];
}

function buildTemplateServiceDrafts(
  _templateId: string,
  runtimeProfile: CreateRuntimeProfile
): ServiceWithId[] {
  return withServiceIds(
    buildTemplateServices(runtimeProfile).map((service) => ({
      ...service,
      appDir: service.appDir ?? '.',
      isPublic: service.type === 'web',
    }))
  );
}

function buildImportFallbackServices(runtimeProfile: CreateRuntimeProfile): ServiceWithId[] {
  return buildTemplateServiceDrafts('nextjs', runtimeProfile);
}

function createDatabaseDraft(type: DatabaseWithId['type']): DatabaseWithId {
  return {
    _id: nanoid(),
    name: type === 'postgresql' ? 'primary' : type,
    type,
    plan: 'starter',
    provisionType: type === 'mysql' || type === 'mongodb' ? 'standalone' : 'shared',
  };
}

function toServicePayload(service: ServiceWithId): ServiceConfig {
  return {
    name: service.name,
    type: service.type,
    ...(service.appDir && service.appDir !== '.' ? { monorepo: { appDir: service.appDir } } : {}),
    ...(service.build ? { build: service.build } : {}),
    run: {
      command: service.run.command,
      ...(typeof service.run.port === 'number' ? { port: service.run.port } : {}),
    },
    ...(service.healthcheck ? { healthcheck: service.healthcheck } : {}),
    ...(service.scaling ? { scaling: service.scaling } : {}),
    ...(service.resources ? { resources: service.resources } : {}),
    ...(service.type === 'cron' && service.schedule ? { schedule: service.schedule } : {}),
    ...(typeof service.isPublic === 'boolean' ? { isPublic: service.isPublic } : {}),
  };
}

export function CreateProjectForm({ teamScopes, templates }: CreateProjectFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('mode');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAnalyze, setIsLoadingAnalyze] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [submitSnapshot, setSubmitSnapshot] = useState<{
    platformSignals: {
      chips: Array<{ key: string; label: string; tone: 'danger' | 'neutral' }>;
      primarySummary: string | null;
      nextActionLabel: string | null;
    };
  } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    mode: 'import',
    repositoryId: '',
    repositoryName: '',
    repositoryFullName: '',
    isPrivate: true,
    template: templates[0]?.id ?? 'nextjs',
    name: '',
    slug: '',
    description: '',
    teamId: teamScopes[0]?.id || '',
    services: [],
    databases: [],
    domain: '',
    useCustomDomain: false,
    productionBranch: 'main',
    autoDeploy: true,
    productionDeploymentStrategy: 'controlled',
    previewDatabaseStrategy: 'inherit',
    runtimeProfile: 'standard',
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
  const [configAdvancedOpen, setConfigAdvancedOpen] = useState(false);
  const [reviewServicesOpen, setReviewServicesOpen] = useState(false);
  const [reviewDatabasesOpen, setReviewDatabasesOpen] = useState(false);

  const selectedTeam =
    teamScopes.find((team) => team.id === formData.teamId) ?? teamScopes[0] ?? null;
  const selectedModeSignals =
    formData.mode === 'import' ? selectedTeam?.importSignals : selectedTeam?.createSignals;
  const currentStepIndex = STEPS.findIndex((step) => step.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;
  const activeServices = formData.services.filter((service) => !service.disabled);
  const runtimeProfileLabel =
    createRuntimeProfiles.find((profile) => profile.value === formData.runtimeProfile)?.label ??
    formData.runtimeProfile;
  const deploymentStrategyLabel =
    getEnvironmentDeploymentStrategyLabel(formData.productionDeploymentStrategy) ??
    formData.productionDeploymentStrategy;
  const previewDatabaseStrategyLabel =
    getEnvironmentDatabaseStrategyLabel(formData.previewDatabaseStrategy) ??
    formData.previewDatabaseStrategy;

  const fetchRepositories = useCallback(
    async (search?: string) => {
      const scope = teamScopes.find((team) => team.id === formData.teamId);
      if (!scope?.importEnabled) {
        setRepositories([]);
        return;
      }

      const url = new URL('/api/git/repositories', window.location.origin);
      url.searchParams.set('teamId', formData.teamId);
      if (search) {
        url.searchParams.set('search', search);
      }

      const response = await fetch(url);
      if (!response.ok) {
        setRepositories([]);
        return;
      }

      const data = await response.json();
      setRepositories(data);
    },
    [formData.teamId, teamScopes]
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

        const response = await fetch(url);
        if (!response.ok) {
          const error = await response.json();
          setAnalyzeError(error.error || '分析仓库失败');
          setFormData((prev) => ({
            ...prev,
            services: buildImportFallbackServices(prev.runtimeProfile),
            monorepoType: 'none',
            hasDockerBake: false,
            bakeTargets: [],
          }));
          return;
        }

        const data = await response.json();
        const nextServices = withServiceIds(
          (data.services as AnalyzeServiceResponse[]).map((service) =>
            normalizeService(service, formData.runtimeProfile)
          )
        );

        setFormData((prev) => ({
          ...prev,
          services: nextServices,
          monorepoType: data.monorepoType ?? 'none',
          hasDockerBake: Boolean(data.hasDockerBake),
          bakeTargets: Array.isArray(data.bakeTargets) ? data.bakeTargets : [],
        }));
      } catch (error) {
        console.error('Failed to analyze repository:', error);
        setAnalyzeError('分析仓库失败');
        setFormData((prev) => ({
          ...prev,
          services: buildImportFallbackServices(prev.runtimeProfile),
          monorepoType: 'none',
          hasDockerBake: false,
          bakeTargets: [],
        }));
      } finally {
        setIsLoadingAnalyze(false);
      }
    },
    [formData.teamId, formData.runtimeProfile]
  );

  useEffect(() => {
    if (currentStep === 'repository' && formData.mode === 'import') {
      fetchRepositories(searchQuery);
    }
  }, [currentStep, fetchRepositories, formData.mode, searchQuery]);

  const updateTeamId = (teamId: string) => {
    setSubmitSnapshot(null);
    setAnalyzeError(null);
    setRepositories([]);
    setSearchQuery('');
    setFormData((prev) => ({
      ...prev,
      teamId,
      repositoryId: prev.mode === 'import' ? '' : prev.repositoryId,
      repositoryFullName: prev.mode === 'import' ? '' : prev.repositoryFullName,
      services: prev.mode === 'import' ? [] : prev.services,
    }));
  };

  const switchMode = (mode: CreateMode) => {
    setSubmitSnapshot(null);
    setAnalyzeError(null);
    setCurrentStep('mode');
    setSearchQuery('');
    setRepositories([]);
    setFormData((prev) => ({
      ...prev,
      mode,
      repositoryId: '',
      repositoryFullName: '',
      services:
        mode === 'create' ? buildTemplateServiceDrafts(prev.template, prev.runtimeProfile) : [],
      monorepoType: 'none',
      hasDockerBake: false,
      bakeTargets: [],
    }));
  };

  const updateService = (serviceId: string, updater: (service: ServiceWithId) => ServiceWithId) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.map((service) =>
        service._id === serviceId ? updater(service) : service
      ),
    }));
  };

  const updateRuntimeProfile = (runtimeProfile: CreateRuntimeProfile) => {
    setFormData((prev) => {
      if (prev.mode === 'create') {
        return {
          ...prev,
          runtimeProfile,
          services: buildTemplateServiceDrafts(prev.template, runtimeProfile),
        };
      }

      return {
        ...prev,
        runtimeProfile,
        services: prev.services.map((service) => {
          const { _id, disabled, ...draft } = service;
          return {
            ...normalizeService(draft, runtimeProfile),
            _id,
            disabled,
          };
        }),
      };
    });
  };

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

  const selectRepository = async (repository: (typeof repositories)[0]) => {
    setFormData((prev) => ({
      ...prev,
      repositoryId: repository.id,
      repositoryFullName: repository.fullName,
      repositoryName: repository.name,
      name: repository.name,
      slug: repository.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      productionBranch: repository.defaultBranch || 'main',
    }));

    await analyzeRepository(repository.fullName, repository.defaultBranch || 'main');
    setCurrentStep('config');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitSnapshot(null);

    try {
      const result = await submitCreateProject({
        mode: formData.mode,
        repositoryId: formData.repositoryId || undefined,
        repositoryFullName: formData.repositoryFullName || undefined,
        isPrivate: formData.isPrivate,
        template: formData.mode === 'create' ? formData.template : undefined,
        name: formData.name,
        slug: formData.slug,
        description: formData.description || undefined,
        teamId: formData.teamId,
        services: activeServices.map(toServicePayload),
        databases: formData.databases.map((database) => ({
          name: database.name,
          type: database.type,
          plan: database.plan,
          provisionType: database.provisionType,
          ...(database.externalUrl ? { externalUrl: database.externalUrl } : {}),
        })),
        domain: formData.domain || undefined,
        useCustomDomain: formData.useCustomDomain,
        productionBranch: formData.productionBranch,
        autoDeploy: formData.autoDeploy,
        productionDeploymentStrategy: formData.productionDeploymentStrategy,
        previewDatabaseStrategy: formData.previewDatabaseStrategy,
        runtimeProfile: formData.runtimeProfile,
      });

      if (result.ok) {
        router.push(`/projects/${result.project.id}/initializing`);
        return;
      }

      setSubmitSnapshot(result.snapshot);
    } catch (error) {
      console.error('Failed to create project:', error);
      setSubmitSnapshot({
        platformSignals: {
          chips: [{ key: 'create:request-failed', label: '创建项目失败', tone: 'danger' }],
          primarySummary: '创建请求失败，请稍后重试',
          nextActionLabel: '检查网络后重试',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'mode':
        return formData.mode === 'import'
          ? Boolean(selectedTeam?.importEnabled)
          : Boolean(selectedTeam?.createEnabled && templates.length > 0);
      case 'repository':
        if (formData.mode === 'import') {
          return Boolean(formData.repositoryId && selectedTeam?.importEnabled);
        }

        return Boolean(
          formData.repositoryName.trim() && selectedTeam?.createEnabled && formData.template
        );
      case 'config':
        return Boolean(
          formData.name.trim() &&
            formData.slug.trim() &&
            formData.productionBranch.trim() &&
            (!formData.useCustomDomain || formData.domain.trim()) &&
            formData.services.length > 0
        );
      case 'review': {
        const externalDatabasesValid = formData.databases
          .filter((database) => database.provisionType === 'external')
          .every((database) => Boolean(database.externalUrl?.trim()));
        return activeServices.length > 0 && externalDatabasesValid;
      }
      default:
        return false;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium',
                  index <= currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'ml-2 hidden text-sm sm:block',
                  index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.title}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-12 sm:w-20',
                    index < currentStepIndex ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {submitSnapshot && (
          <PlatformSignalBlock
            chips={submitSnapshot.platformSignals.chips}
            summary={submitSnapshot.platformSignals.primarySummary}
            nextActionLabel={submitSnapshot.platformSignals.nextActionLabel}
          />
        )}

        {currentStep === 'mode' && (
          <div className="space-y-6">
            {selectedTeam && (
              <div className="rounded-[20px] border border-border bg-secondary/30 p-4">
                <div className="text-sm font-medium">{selectedTeam.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedTeam.roleLabel} ·{' '}
                  {selectedTeam.providerLabels.length > 0
                    ? selectedTeam.providerLabels.join(' / ')
                    : '还没有可用代码托管授权'}
                </div>
                <PlatformSignalBlock
                  chips={selectedModeSignals?.chips ?? []}
                  summary={selectedModeSignals?.primarySummary}
                  nextActionLabel={selectedModeSignals?.nextActionLabel}
                  chipsClassName="mt-3"
                  summaryClassName="mt-3"
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h2 className="mb-1 text-lg font-semibold">项目入口方式</h2>
              </div>

              <div className="space-y-2">
                <Label>团队</Label>
                <Select value={formData.teamId} onValueChange={updateTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择团队" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamScopes.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => switchMode('import')}
                  className={cn(
                    'rounded-[22px] border px-5 py-5 text-left transition-colors',
                    formData.mode === 'import'
                      ? 'border-foreground bg-secondary/40'
                      : 'border-border hover:bg-secondary/40'
                  )}
                >
                  <div className="font-medium">导入仓库</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedTeam?.importSummary ?? '连接现有 Git 仓库'}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">保留现有代码</Badge>
                    <Badge variant="outline">自动识别服务</Badge>
                    <Badge variant="outline">接入发布链路</Badge>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('create')}
                  className={cn(
                    'rounded-[22px] border px-5 py-5 text-left transition-colors',
                    formData.mode === 'create'
                      ? 'border-foreground bg-secondary/40'
                      : 'border-border hover:bg-secondary/40'
                  )}
                >
                  <div className="font-medium">新建仓库</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedTeam?.createSummary ?? '从平台模板直接创建一个新仓库'}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">仓库自动创建</Badge>
                    <Badge variant="outline">默认交付链路</Badge>
                    <Badge variant="outline">资源档位预置</Badge>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'repository' && (
          <div className="space-y-6">
            <div className="rounded-[20px] border border-border bg-secondary/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{selectedTeam?.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {selectedTeam?.roleLabel} ·{' '}
                    {selectedTeam?.providerLabels.length
                      ? selectedTeam.providerLabels.join(' / ')
                      : '还没有可用代码托管授权'}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formData.mode === 'import'
                    ? selectedTeam?.importSummary
                    : selectedTeam?.createSummary}
                </div>
              </div>
            </div>

            {formData.mode === 'import' ? (
              <>
                <div>
                  <h2 className="mb-1 text-lg font-semibold">选择要接入的仓库</h2>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => handleSearch(event.target.value)}
                    placeholder="搜索仓库..."
                    className="pl-9"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto rounded-[20px] border border-border">
                  {!selectedTeam?.importEnabled ? (
                    <div className="p-8 text-center text-muted-foreground">
                      当前团队没有可用的仓库读取授权
                    </div>
                  ) : repositories.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">没有找到仓库</div>
                  ) : (
                    repositories.map((repository) => (
                      <button
                        key={repository.id}
                        type="button"
                        onClick={() => selectRepository(repository)}
                        className={cn(
                          'flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-secondary/40',
                          formData.repositoryId === repository.id && 'bg-secondary/40'
                        )}
                      >
                        <div>
                          <div className="font-medium">{repository.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            默认分支 {repository.defaultBranch}
                          </div>
                        </div>
                        {formData.repositoryId === repository.id && (
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
                  <h2 className="mb-1 text-lg font-semibold">定义新仓库骨架</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>仓库名称</Label>
                    <Input
                      value={formData.repositoryName}
                      onChange={(event) => {
                        const repositoryName = event.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          repositoryName,
                          name: repositoryName,
                          slug: repositoryName
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                        }));
                      }}
                      placeholder="nexusnote"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>仓库可见性</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, isPrivate: false }))}
                        className={cn(
                          'rounded-[18px] border px-4 py-4 text-left transition-colors',
                          !formData.isPrivate
                            ? 'border-foreground bg-secondary/40'
                            : 'border-border hover:bg-secondary/40'
                        )}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          <Globe className="h-4 w-4" />
                          公开
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">适合开源项目</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, isPrivate: true }))}
                        className={cn(
                          'rounded-[18px] border px-4 py-4 text-left transition-colors',
                          formData.isPrivate
                            ? 'border-foreground bg-secondary/40'
                            : 'border-border hover:bg-secondary/40'
                        )}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          <Shield className="h-4 w-4" />
                          私有
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">适合业务仓库</div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>模板</Label>
                  {templates.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
                      当前没有可用模板，先补充模板目录后再开放创建。
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              template: template.id,
                              services: buildTemplateServiceDrafts(
                                template.id,
                                prev.runtimeProfile
                              ),
                            }))
                          }
                          className={cn(
                            'rounded-[18px] border px-4 py-4 text-left transition-colors',
                            formData.template === template.id
                              ? 'border-foreground bg-secondary/40'
                              : 'border-border hover:bg-secondary/40'
                          )}
                        >
                          <div className="font-medium">{template.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {template.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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
                <p className="text-sm text-muted-foreground">正在分析仓库结构与服务入口...</p>
              </div>
            ) : null}

            {analyzeError ? (
              <div className="rounded-[20px] border border-border bg-secondary/30 p-4">
                <p className="text-sm text-foreground">{analyzeError}</p>
                <p className="mt-1 text-xs text-muted-foreground">已回退到平台默认服务配置</p>
              </div>
            ) : null}

            <div>
              <h2 className="mb-1 text-lg font-semibold">把交付参数一次配齐</h2>
            </div>

            <div className="rounded-[20px] border border-border bg-secondary/20 p-4">
              <div className="text-sm font-medium">平台推荐配置</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-[16px] border border-border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">资源档位</div>
                  <div className="mt-1 text-sm font-medium">{runtimeProfileLabel}</div>
                </div>
                <div className="rounded-[16px] border border-border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">生产发布</div>
                  <div className="mt-1 text-sm font-medium">{deploymentStrategyLabel}</div>
                </div>
                <div className="rounded-[16px] border border-border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">预览数据库</div>
                  <div className="mt-1 text-sm font-medium">{previewDatabaseStrategyLabel}</div>
                </div>
                <div className="rounded-[16px] border border-border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">基础环境</div>
                  <div className="mt-1 text-sm font-medium">
                    {formData.autoDeploy ? '自动部署' : '手动触发'}
                  </div>
                </div>
                <div className="rounded-[16px] border border-border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">识别服务</div>
                  <div className="mt-1 text-sm font-medium">{formData.services.length} 个</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>项目名称</Label>
                <Input
                  value={formData.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name,
                      slug: name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, ''),
                    }));
                  }}
                  placeholder="nexusnote"
                />
              </div>

              <div className="space-y-2">
                <Label>项目标识</Label>
                <Input
                  value={formData.slug}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, slug: event.target.value }))
                  }
                  placeholder="nexusnote"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>项目描述</Label>
              <Textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="一句话说明这个项目做什么。"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>生产分支</Label>
                <div className="relative">
                  <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={formData.productionBranch}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        productionBranch: event.target.value,
                      }))
                    }
                    className="pl-9"
                    placeholder="main"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>交付节奏</Label>
                <div className="rounded-[18px] border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">基础环境自动部署</div>
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

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">资源档位</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {createRuntimeProfiles.map((profile) => (
                  <button
                    key={profile.value}
                    type="button"
                    onClick={() => updateRuntimeProfile(profile.value)}
                    className={cn(
                      'rounded-[18px] border px-4 py-4 text-left transition-colors',
                      formData.runtimeProfile === profile.value
                        ? 'border-foreground bg-secondary/40'
                        : 'border-border hover:bg-secondary/40'
                    )}
                  >
                    <div className="font-medium">{profile.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{profile.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">生产发布方式</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {createProductionDeploymentStrategies.map((strategy) => (
                  <button
                    key={strategy.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        productionDeploymentStrategy: strategy.value,
                      }))
                    }
                    className={cn(
                      'rounded-[18px] border px-4 py-4 text-left transition-colors',
                      formData.productionDeploymentStrategy === strategy.value
                        ? 'border-foreground bg-secondary/40'
                        : 'border-border hover:bg-secondary/40'
                    )}
                  >
                    <div className="font-medium">{strategy.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{strategy.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">预览环境数据库策略</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {createPreviewDatabaseStrategies.map((strategy) => (
                  <button
                    key={strategy.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        previewDatabaseStrategy: strategy.value,
                      }))
                    }
                    className={cn(
                      'rounded-[18px] border px-4 py-4 text-left transition-colors',
                      formData.previewDatabaseStrategy === strategy.value
                        ? 'border-foreground bg-secondary/40'
                        : 'border-border hover:bg-secondary/40'
                    )}
                  >
                    <div className="font-medium">{strategy.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{strategy.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] border border-border">
              <button
                type="button"
                onClick={() => setConfigAdvancedOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
              >
                <div>
                  <div className="text-sm font-medium">高级调整</div>
                </div>
                {configAdvancedOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {configAdvancedOpen && (
                <div className="space-y-4 border-t border-border px-4 py-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-[18px] border border-border px-4 py-3">
                      <div>
                        <div className="text-sm font-medium">自定义域名</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          创建时就把主域名挂上，避免后面再补接入。
                        </div>
                      </div>
                      <Switch
                        checked={formData.useCustomDomain}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, useCustomDomain: checked }))
                        }
                      />
                    </div>
                    {formData.useCustomDomain && (
                      <Input
                        value={formData.domain}
                        onChange={(event) =>
                          setFormData((prev) => ({ ...prev, domain: event.target.value }))
                        }
                        placeholder="app.example.com"
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">服务预览</h3>
                      </div>
                      <Badge variant="outline">{formData.services.length} 个服务</Badge>
                    </div>

                    {(formData.monorepoType !== 'none' || formData.hasDockerBake) && (
                      <div className="flex flex-wrap gap-2 rounded-[18px] bg-secondary/40 p-3 text-xs text-muted-foreground">
                        {formData.monorepoType !== 'none' && (
                          <Badge variant="secondary">Monorepo · {formData.monorepoType}</Badge>
                        )}
                        {formData.hasDockerBake && (
                          <Badge variant="secondary">docker-bake.hcl</Badge>
                        )}
                        {formData.bakeTargets.map((target) => (
                          <Badge key={target} variant="outline">
                            {target}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="overflow-hidden rounded-[20px] border border-border">
                      {formData.services.length === 0 ? (
                        <div className="p-5 text-sm text-muted-foreground">
                          当前还没有可创建的服务。
                        </div>
                      ) : (
                        formData.services.map((service) => (
                          <div
                            key={service._id}
                            className="border-b border-border px-4 py-4 last:border-b-0"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{service.name}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {service.appDir} · {service.type}
                                  {typeof service.run.port === 'number'
                                    ? ` · port ${service.run.port}`
                                    : ''}
                                </div>
                              </div>
                              <Badge variant="outline">{getServiceRuntimeSummary(service)}</Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-1 text-lg font-semibold">最后确认</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[20px] border border-border px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  项目
                </div>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">名称</span>
                    <span className="font-medium">{formData.name || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">仓库</span>
                    <span className="font-medium">
                      {formData.mode === 'import'
                        ? formData.repositoryFullName
                        : `${formData.repositoryName}（${formData.isPrivate ? '私有' : '公开'}）`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">生产分支</span>
                    <span className="font-medium">{formData.productionBranch}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">主域名</span>
                    <span className="font-medium">
                      {formData.useCustomDomain ? formData.domain : '平台默认域名'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-border px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  交付策略
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant={formData.autoDeploy ? 'default' : 'secondary'}>
                    基础环境自动部署：{formData.autoDeploy ? '开启' : '关闭'}
                  </Badge>
                  <Badge variant="secondary">
                    生产发布：
                    {getEnvironmentDeploymentStrategyLabel(formData.productionDeploymentStrategy) ??
                      formData.productionDeploymentStrategy}
                  </Badge>
                  <Badge variant="secondary">
                    预览库：
                    {getEnvironmentDatabaseStrategyLabel(formData.previewDatabaseStrategy) ??
                      formData.previewDatabaseStrategy}
                  </Badge>
                  <Badge variant="outline">
                    资源档位：
                    {createRuntimeProfiles.find(
                      (profile) => profile.value === formData.runtimeProfile
                    )?.label ?? formData.runtimeProfile}
                  </Badge>
                </div>
              </div>
            </div>

            {selectedTeam && (
              <div className="rounded-[18px] bg-secondary/40 p-3 text-sm text-muted-foreground">
                {formData.mode === 'import'
                  ? selectedTeam.importSummary
                  : selectedTeam.createSummary}
              </div>
            )}

            <div className="rounded-[20px] border border-border bg-secondary/20 p-4">
              <div className="text-sm font-medium">最终会创建这些能力</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[16px] border border-border bg-background px-4 py-3">
                  <div className="text-xs text-muted-foreground">启用服务</div>
                  <div className="mt-1 text-sm font-medium">{activeServices.length} 个</div>
                </div>
                <div className="rounded-[16px] border border-border bg-background px-4 py-3">
                  <div className="text-xs text-muted-foreground">数据库</div>
                  <div className="mt-1 text-sm font-medium">{formData.databases.length} 个</div>
                </div>
                <div className="rounded-[16px] border border-border bg-background px-4 py-3">
                  <div className="text-xs text-muted-foreground">默认链路</div>
                  <div className="mt-1 text-sm font-medium">
                    {deploymentStrategyLabel} · {previewDatabaseStrategyLabel}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-border">
              <button
                type="button"
                onClick={() => setReviewServicesOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
              >
                <div>
                  <h3 className="text-sm font-medium">高级调整 · 服务与资源</h3>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{activeServices.length} 个启用中</Badge>
                  {reviewServicesOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {reviewServicesOpen && (
                <div className="border-t border-border px-4 py-4">
                  <div className="overflow-hidden rounded-[20px] border border-border">
                    {formData.services.length === 0 ? (
                      <div className="p-5 text-sm text-muted-foreground">没有识别到服务。</div>
                    ) : (
                      formData.services.map((service) => (
                        <div
                          key={service._id}
                          className="border-b border-border px-4 py-4 last:border-b-0"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={!service.disabled}
                                  onCheckedChange={() =>
                                    updateService(service._id, (current) => ({
                                      ...current,
                                      disabled: !current.disabled,
                                    }))
                                  }
                                />
                                <div className="font-medium">{service.name}</div>
                                <Badge variant="outline">{service.type}</Badge>
                              </div>
                              <div className="pl-11 text-xs text-muted-foreground">
                                {service.appDir} · 启动命令 {service.run.command}
                                {typeof service.run.port === 'number'
                                  ? ` · port ${service.run.port}`
                                  : ''}
                              </div>
                            </div>
                            <Badge variant="secondary">{getServiceRuntimeSummary(service)}</Badge>
                          </div>

                          {!service.disabled && (
                            <div className="mt-4 space-y-4 pl-11">
                              {service.type === 'web' && (
                                <div className="flex items-center justify-between rounded-[16px] border border-border px-4 py-3">
                                  <div>
                                    <div className="text-sm font-medium">公网入口</div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      关闭后服务仍会部署，但不会作为公开入口暴露。
                                    </div>
                                  </div>
                                  <Switch
                                    checked={service.isPublic ?? true}
                                    onCheckedChange={(checked) =>
                                      updateService(service._id, (current) => ({
                                        ...current,
                                        isPublic: checked,
                                      }))
                                    }
                                  />
                                </div>
                              )}

                              <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                  <Label>副本数</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={service.scaling?.min ?? 1}
                                    onChange={(event) =>
                                      updateService(service._id, (current) => {
                                        const min = Number(event.target.value) || 1;
                                        const max =
                                          current.scaling?.max && current.scaling.max < min
                                            ? min
                                            : current.scaling?.max;
                                        return {
                                          ...current,
                                          scaling: {
                                            ...current.scaling,
                                            min,
                                            ...(typeof max === 'number' ? { max } : {}),
                                          },
                                        };
                                      })
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>端口</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={65535}
                                    value={service.run.port ?? ''}
                                    onChange={(event) =>
                                      updateService(service._id, (current) => ({
                                        ...current,
                                        run: {
                                          ...current.run,
                                          port: event.target.value
                                            ? Number(event.target.value)
                                            : undefined,
                                        },
                                      }))
                                    }
                                    disabled={service.type !== 'web'}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>健康检查路径</Label>
                                  <Input
                                    value={service.healthcheck?.path ?? ''}
                                    onChange={(event) =>
                                      updateService(service._id, (current) => ({
                                        ...current,
                                        healthcheck: {
                                          ...current.healthcheck,
                                          path: event.target.value || undefined,
                                          interval: current.healthcheck?.interval ?? 30,
                                        },
                                      }))
                                    }
                                    placeholder={service.type === 'web' ? '/api/health' : '/health'}
                                    disabled={service.type !== 'web'}
                                  />
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="space-y-2">
                                  <Label>CPU 请求</Label>
                                  <Input
                                    value={service.resources?.cpuRequest ?? ''}
                                    onChange={(event) =>
                                      updateService(service._id, (current) => ({
                                        ...current,
                                        resources: {
                                          ...current.resources,
                                          cpuRequest: event.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="100m"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>CPU 上限</Label>
                                  <Input
                                    value={service.resources?.cpuLimit ?? ''}
                                    onChange={(event) =>
                                      updateService(service._id, (current) => ({
                                        ...current,
                                        resources: {
                                          ...current.resources,
                                          cpuLimit: event.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="500m"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>内存请求</Label>
                                  <Input
                                    value={service.resources?.memoryRequest ?? ''}
                                    onChange={(event) =>
                                      updateService(service._id, (current) => ({
                                        ...current,
                                        resources: {
                                          ...current.resources,
                                          memoryRequest: event.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="256Mi"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>内存上限</Label>
                                  <Input
                                    value={service.resources?.memoryLimit ?? ''}
                                    onChange={(event) =>
                                      updateService(service._id, (current) => ({
                                        ...current,
                                        resources: {
                                          ...current.resources,
                                          memoryLimit: event.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="512Mi"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[20px] border border-border">
              <button
                type="button"
                onClick={() => setReviewDatabasesOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
              >
                <div>
                  <h3 className="text-sm font-medium">高级调整 · 数据库</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    需要托管数据库或外部连接时再展开。
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{formData.databases.length} 个</Badge>
                  {reviewDatabasesOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {reviewDatabasesOpen && (
                <div className="space-y-3 border-t border-border px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {DATABASE_TYPE_OPTIONS.map((databaseType) => (
                        <Button
                          key={databaseType.value}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              databases: [
                                ...prev.databases,
                                createDatabaseDraft(databaseType.value),
                              ],
                            }))
                          }
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {databaseType.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[20px] border border-border">
                    {formData.databases.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                        <Database className="h-5 w-5 opacity-40" />
                        <span className="text-sm">没有数据库</span>
                      </div>
                    ) : (
                      formData.databases.map((database) => {
                        const sharedDisabled =
                          database.type === 'mysql' || database.type === 'mongodb';

                        const updateDatabase = (updates: Partial<DatabaseWithId>) => {
                          setFormData((prev) => ({
                            ...prev,
                            databases: prev.databases.map((item) =>
                              item._id === database._id ? { ...item, ...updates } : item
                            ),
                          }));
                        };

                        return (
                          <div
                            key={database._id}
                            className="space-y-4 border-b border-border px-4 py-4 last:border-b-0"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  value={database.name}
                                  onChange={(event) => updateDatabase({ name: event.target.value })}
                                  className="h-9 w-44"
                                />
                                <Badge variant="outline">
                                  {
                                    DATABASE_TYPE_OPTIONS.find(
                                      (option) => option.value === database.type
                                    )?.label
                                  }
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    databases: prev.databases.filter(
                                      (item) => item._id !== database._id
                                    ),
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>规格</Label>
                                <Select
                                  value={database.plan}
                                  onValueChange={(value: DatabaseWithId['plan']) =>
                                    updateDatabase({ plan: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="选择规格" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DATABASE_PLAN_OPTIONS.map((plan) => (
                                      <SelectItem key={plan.value} value={plan.value}>
                                        {plan.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>接入方式</Label>
                                <div className="flex flex-wrap gap-2">
                                  {(
                                    [
                                      { value: 'shared', label: '共享资源' },
                                      { value: 'standalone', label: '独立资源' },
                                      { value: 'external', label: '外部实例' },
                                    ] as const
                                  ).map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      disabled={option.value === 'shared' && sharedDisabled}
                                      onClick={() =>
                                        updateDatabase({ provisionType: option.value })
                                      }
                                      className={cn(
                                        'rounded-full border px-3 py-1.5 text-xs transition-colors',
                                        database.provisionType === option.value
                                          ? 'border-foreground bg-foreground text-background'
                                          : 'border-border bg-background hover:bg-secondary/40',
                                        option.value === 'shared' &&
                                          sharedDisabled &&
                                          'cursor-not-allowed opacity-40'
                                      )}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {database.provisionType === 'external' && (
                              <div className="space-y-2">
                                <Label>连接串</Label>
                                <Input
                                  value={database.externalUrl ?? ''}
                                  onChange={(event) =>
                                    updateDatabase({ externalUrl: event.target.value })
                                  }
                                  placeholder={
                                    database.type === 'redis'
                                      ? 'redis://:password@host:6379'
                                      : database.type === 'mongodb'
                                        ? 'mongodb://user:pass@host:27017/db'
                                        : 'postgresql://user:pass@host:5432/db'
                                  }
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 mt-6 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            className="rounded-xl px-4"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
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
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
