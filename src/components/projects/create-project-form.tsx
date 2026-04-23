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
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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
import { Textarea } from '@/components/ui/textarea';
import type { ServiceConfig } from '@/lib/config/parser';
import type {
  PlatformDatabaseProvisionType,
  PlatformDatabaseType,
} from '@/lib/databases/platform-support';
import {
  formatUnsupportedPreviewCloneDatabasesMessage,
  getDefaultDatabaseProvisionType,
  getUnsupportedPreviewCloneDatabases,
  supportsDatabaseProvisionType,
} from '@/lib/databases/platform-support';
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
import {
  type CreateEnvironmentTemplate,
  createEnvironmentTemplates,
  getCreateEnvironmentTemplateLabel,
} from '@/lib/projects/environment-topology';
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
  type: PlatformDatabaseType;
  plan: 'starter' | 'standard' | 'premium';
  provisionType: PlatformDatabaseProvisionType;
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
  environmentTemplate: CreateEnvironmentTemplate;
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
    provisionType: getDefaultDatabaseProvisionType(type),
  };
}

function getChoiceCardClass(selected: boolean): string {
  return cn(
    'relative cursor-pointer rounded-[20px] px-4 py-4 text-left transition-all duration-150',
    selected
      ? 'bg-[rgba(255,255,255,0.92)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_34px_-22px_rgba(55,53,47,0.18)] ring-1 ring-[rgba(55,53,47,0.06)]'
      : 'bg-[rgba(255,255,255,0.76)] shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_10px_24px_-22px_rgba(55,53,47,0.12)] ring-1 ring-[rgba(55,53,47,0.035)] hover:bg-[rgba(255,255,255,0.88)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.84),0_14px_30px_-22px_rgba(55,53,47,0.16)] hover:ring-[rgba(55,53,47,0.05)]'
  );
}

function getCompactChoiceCardClass(selected: boolean): string {
  return cn(
    'rounded-[18px] px-4 py-4 text-left transition-all duration-150',
    selected
      ? 'bg-[rgba(255,255,255,0.92)] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_12px_28px_-22px_rgba(55,53,47,0.16)] ring-1 ring-[rgba(55,53,47,0.055)]'
      : 'bg-[rgba(255,255,255,0.74)] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_8px_20px_-20px_rgba(55,53,47,0.1)] ring-1 ring-[rgba(55,53,47,0.03)] hover:bg-[rgba(255,255,255,0.86)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_12px_24px_-20px_rgba(55,53,47,0.14)] hover:ring-[rgba(55,53,47,0.045)]'
  );
}

function getPillChoiceClass(selected: boolean, disabled = false): string {
  return cn(
    'rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-150',
    disabled
      ? 'cursor-not-allowed bg-[rgba(255,255,255,0.42)] text-muted-foreground/70 opacity-45 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset]'
      : selected
        ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(55,53,47,0.16)]'
        : 'bg-[rgba(255,255,255,0.78)] text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.78)_inset,0_6px_18px_rgba(55,53,47,0.03)] hover:bg-[rgba(255,255,255,0.94)] hover:text-foreground'
  );
}

const reviewShellClassName =
  'rounded-[22px] bg-[rgba(251,250,247,0.96)] px-5 py-5 shadow-[0_18px_40px_rgba(55,53,47,0.05)]';

const reviewSubtleClassName = 'rounded-[16px] bg-[rgba(15,23,42,0.03)] px-4 py-4';

interface SectionHeadingProps {
  title: string;
  description?: string;
}

function SectionHeading({ title, description }: SectionHeadingProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

interface ChoiceCardButtonProps {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  dense?: boolean;
  disabled?: boolean;
  className?: string;
}

function ChoiceCardButton({
  title,
  description,
  selected,
  onClick,
  icon,
  dense = false,
  disabled = false,
  className,
}: ChoiceCardButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        dense ? getCompactChoiceCardClass(selected) : getChoiceCardClass(selected),
        'h-auto w-full items-start justify-start px-5 py-5 text-left whitespace-normal',
        disabled && 'cursor-not-allowed opacity-45',
        className
      )}
    >
      <div className="flex w-full flex-col items-start gap-3">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
            {icon}
            <span className="min-w-0 break-words">{title}</span>
          </div>
          {selected ? (
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(55,53,47,0.92)] text-background shadow-[0_6px_16px_rgba(55,53,47,0.12)]">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        {description ? (
          <div className="min-w-0 break-words text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
    </Button>
  );
}

interface DisclosurePanelProps {
  title: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function DisclosurePanel({ title, meta, open, onToggle, children }: DisclosurePanelProps) {
  return (
    <div className={cn(reviewShellClassName, 'overflow-hidden px-0 py-0')}>
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className="h-auto w-full justify-between rounded-none px-4 py-4 text-left text-foreground hover:bg-transparent"
      >
        <div className="text-sm font-medium">{title}</div>
        <div className="flex items-center gap-3">
          {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </Button>

      {open ? <div className="console-divider-top space-y-4 px-5 py-4">{children}</div> : null}
    </div>
  );
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
    environmentTemplate: 'staging_production_preview',
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
  const currentStepIndex = STEPS.findIndex((step) => step.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;
  const activeServices = formData.services.filter((service) => !service.disabled);
  const deploymentStrategyLabel =
    getEnvironmentDeploymentStrategyLabel(formData.productionDeploymentStrategy) ??
    formData.productionDeploymentStrategy;
  const previewDatabaseStrategyLabel =
    getEnvironmentDatabaseStrategyLabel(formData.previewDatabaseStrategy) ??
    formData.previewDatabaseStrategy;
  const environmentTemplateLabel = getCreateEnvironmentTemplateLabel(formData.environmentTemplate);
  const previewCloneUnsupportedDatabases = getUnsupportedPreviewCloneDatabases(formData.databases);
  const isolatedCloneBlockedMessage =
    previewCloneUnsupportedDatabases.length > 0
      ? formatUnsupportedPreviewCloneDatabasesMessage(previewCloneUnsupportedDatabases)
      : null;

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

      try {
        const url = new URL('/api/git/repositories/analyze', window.location.origin);
        url.searchParams.set('repositoryFullName', repositoryFullName);
        url.searchParams.set('teamId', formData.teamId);
        url.searchParams.set('branch', branch);

        const response = await fetch(url);
        if (!response.ok) {
          const error = await response.json();
          toast.error(error.error || '识别仓库失败');
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
        toast.error('识别仓库失败');
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

  useEffect(() => {
    if (formData.previewDatabaseStrategy !== 'isolated_clone' || !isolatedCloneBlockedMessage) {
      return;
    }

    setFormData((prev) =>
      prev.previewDatabaseStrategy === 'isolated_clone'
        ? {
            ...prev,
            previewDatabaseStrategy: 'inherit',
          }
        : prev
    );
  }, [formData.previewDatabaseStrategy, isolatedCloneBlockedMessage]);

  const updateTeamId = (teamId: string) => {
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
        environmentTemplate: formData.environmentTemplate,
      });

      if (result.ok) {
        router.push(`/projects/${result.project.id}/initializing`);
        return;
      }

      toast.error(result.snapshot.platformSignals.primarySummary ?? '创建项目失败，请稍后重试', {
        description: result.snapshot.platformSignals.nextActionLabel ?? undefined,
      });
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('创建请求失败，请稍后重试', {
        description: '检查网络后重试',
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
        return (
          activeServices.length > 0 &&
          externalDatabasesValid &&
          (formData.previewDatabaseStrategy !== 'isolated_clone' || !isolatedCloneBlockedMessage)
        );
      }
      default:
        return false;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 rounded-[24px] bg-[rgba(251,250,248,0.72)] px-2 py-2">
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              创建项目
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {STEPS[currentStepIndex]?.title}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {currentStepIndex + 1} / {STEPS.length}
          </div>
        </div>
        <div className="flex min-w-max items-center justify-between gap-2 overflow-x-auto pb-1">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]',
                  index <= currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white/75 text-muted-foreground'
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
                    'mx-2 h-px w-10 shrink-0 sm:w-16',
                    index < currentStepIndex ? 'bg-primary/55' : 'bg-border/60'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {currentStep === 'mode' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <SectionHeading title="项目入口方式" />

              <div className="space-y-2">
                <Label>团队</Label>
                <Select value={formData.teamId} onValueChange={updateTeamId}>
                  <SelectTrigger className="h-12">
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
                <ChoiceCardButton
                  title="导入仓库"
                  description={selectedTeam?.importSummary ?? '连接现有 Git 仓库'}
                  selected={formData.mode === 'import'}
                  onClick={() => switchMode('import')}
                  dense
                />

                <ChoiceCardButton
                  title="新建仓库"
                  description={selectedTeam?.createSummary ?? '从平台模板直接创建一个新仓库'}
                  selected={formData.mode === 'create'}
                  onClick={() => switchMode('create')}
                  dense
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'repository' && (
          <div className="space-y-6">
            <div className={cn(reviewShellClassName, 'p-4')}>
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
                <SectionHeading title="选择要接入的仓库" />

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => handleSearch(event.target.value)}
                    placeholder="搜索仓库..."
                    className="pl-9"
                  />
                </div>

                <div className={cn(reviewShellClassName, 'max-h-96 overflow-y-auto p-0')}>
                  {!selectedTeam?.importEnabled ? (
                    <EmptyState title="没有可用代码托管授权" className="min-h-40 rounded-none" />
                  ) : repositories.length === 0 ? (
                    <EmptyState title="没有找到仓库" className="min-h-40 rounded-none" />
                  ) : (
                    repositories.map((repository) => (
                      <Button
                        key={repository.id}
                        type="button"
                        variant="ghost"
                        onClick={() => selectRepository(repository)}
                        className={cn(
                          'h-auto w-full justify-between rounded-none px-4 py-4 text-left font-normal whitespace-normal hover:bg-secondary/48',
                          formData.repositoryId === repository.id &&
                            'bg-[rgba(241,239,235,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]'
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
                      </Button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <SectionHeading title="定义新仓库骨架" />

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
                      <ChoiceCardButton
                        title="公开"
                        description="适合开源项目"
                        selected={!formData.isPrivate}
                        onClick={() => setFormData((prev) => ({ ...prev, isPrivate: false }))}
                        icon={<Globe className="h-4 w-4" />}
                        dense
                      />
                      <ChoiceCardButton
                        title="私有"
                        description="适合业务仓库"
                        selected={formData.isPrivate}
                        onClick={() => setFormData((prev) => ({ ...prev, isPrivate: true }))}
                        icon={<Shield className="h-4 w-4" />}
                        dense
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>模板</Label>
                  {templates.length === 0 ? (
                    <EmptyState title="没有可用模板" className="min-h-40" />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {templates.map((template) => (
                        <ChoiceCardButton
                          key={template.id}
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
                          title={template.name}
                          description={template.description}
                          selected={formData.template === template.id}
                          dense
                        />
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
              <div
                className={cn(
                  reviewShellClassName,
                  'flex flex-col items-center justify-center py-12'
                )}
              >
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-foreground" />
                <p className="text-sm text-muted-foreground">正在识别仓库结构...</p>
              </div>
            ) : null}

            <SectionHeading title="项目配置" />

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
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="做什么"
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
                <Label>发布节奏</Label>
                <div className="ui-control flex items-center justify-between gap-3 px-4 py-3">
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
              <SectionHeading title="资源档位" />
              <div className="grid gap-3 md:grid-cols-3">
                {createRuntimeProfiles.map((profile) => (
                  <ChoiceCardButton
                    key={profile.value}
                    onClick={() => updateRuntimeProfile(profile.value)}
                    title={profile.label}
                    description={profile.description}
                    selected={formData.runtimeProfile === profile.value}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SectionHeading title="环境拓扑" />
              <div className="grid gap-3 md:grid-cols-3">
                {createEnvironmentTemplates.map((template) => (
                  <ChoiceCardButton
                    key={template.value}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        environmentTemplate: template.value,
                      }))
                    }
                    title={template.label}
                    description={template.description}
                    selected={formData.environmentTemplate === template.value}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SectionHeading title="生产发布" />
              <div className="grid gap-3 md:grid-cols-2">
                {createProductionDeploymentStrategies.map((strategy) => (
                  <ChoiceCardButton
                    key={strategy.value}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        productionDeploymentStrategy: strategy.value,
                      }))
                    }
                    title={strategy.label}
                    description={strategy.description}
                    selected={formData.productionDeploymentStrategy === strategy.value}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SectionHeading title="预览库策略" />
              <div className="grid gap-3 md:grid-cols-2">
                {createPreviewDatabaseStrategies.map((strategy) => (
                  <ChoiceCardButton
                    key={strategy.value}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        previewDatabaseStrategy: strategy.value,
                      }))
                    }
                    title={strategy.label}
                    description={strategy.description}
                    selected={formData.previewDatabaseStrategy === strategy.value}
                    disabled={
                      strategy.value === 'isolated_clone' && Boolean(isolatedCloneBlockedMessage)
                    }
                  />
                ))}
              </div>
              {isolatedCloneBlockedMessage ? (
                <p className="text-sm text-muted-foreground">{isolatedCloneBlockedMessage}</p>
              ) : null}
            </div>

            <DisclosurePanel
              title="高级"
              open={configAdvancedOpen}
              onToggle={() => setConfigAdvancedOpen((current) => !current)}
            >
              <div className="space-y-3">
                <div className="ui-control flex items-center justify-between px-4 py-3">
                  <div className="text-sm font-medium">自定义域名</div>
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
            </DisclosurePanel>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-6">
            <SectionHeading title="最后确认" />

            <div className={reviewShellClassName}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    项目摘要
                  </div>
                  <div className="text-lg font-semibold text-foreground">
                    {formData.name || '-'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formData.mode === 'import'
                      ? formData.repositoryFullName
                      : `${formData.repositoryName} · ${formData.isPrivate ? '私有仓库' : '公开仓库'}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={formData.autoDeploy ? 'default' : 'secondary'}>
                    {formData.autoDeploy ? '自动部署' : '手动部署'}
                  </Badge>
                  <Badge variant="secondary">{deploymentStrategyLabel}</Badge>
                  <Badge variant="secondary">{previewDatabaseStrategyLabel}</Badge>
                  <Badge variant="secondary">
                    {createRuntimeProfiles.find(
                      (profile) => profile.value === formData.runtimeProfile
                    )?.label ?? formData.runtimeProfile}
                  </Badge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className={reviewSubtleClassName}>
                  <div className="text-xs text-muted-foreground">环境链路</div>
                  <div className="mt-1 text-sm font-medium">{environmentTemplateLabel}</div>
                </div>
                <div className={reviewSubtleClassName}>
                  <div className="text-xs text-muted-foreground">生产分支</div>
                  <div className="mt-1 text-sm font-medium">{formData.productionBranch}</div>
                </div>
                <div className={reviewSubtleClassName}>
                  <div className="text-xs text-muted-foreground">启用服务</div>
                  <div className="mt-1 text-sm font-medium">{activeServices.length} 个</div>
                </div>
                <div className={reviewSubtleClassName}>
                  <div className="text-xs text-muted-foreground">数据库</div>
                  <div className="mt-1 text-sm font-medium">{formData.databases.length} 个</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                访问域名：{formData.useCustomDomain ? formData.domain : '平台默认域名'}
              </div>
            </div>

            <DisclosurePanel
              title="服务设置"
              meta={`${activeServices.length} 个启用`}
              open={reviewServicesOpen}
              onToggle={() => setReviewServicesOpen((current) => !current)}
            >
              <div className="space-y-3">
                {formData.services.length === 0 ? (
                  <div className="overflow-hidden rounded-[18px] bg-[rgba(15,23,42,0.03)]">
                    <EmptyState title="没有识别到服务" className="min-h-40 rounded-none" />
                  </div>
                ) : (
                  formData.services.map((service) => (
                    <div key={service._id} className={reviewSubtleClassName}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex min-w-0 items-center gap-3">
                            <Switch
                              checked={!service.disabled}
                              onCheckedChange={() =>
                                updateService(service._id, (current) => ({
                                  ...current,
                                  disabled: !current.disabled,
                                }))
                              }
                            />
                            <div className="min-w-0 break-words font-medium">{service.name}</div>
                            <Badge variant="secondary">{service.type}</Badge>
                          </div>
                          <div className="min-w-0 break-all pl-11 text-xs text-muted-foreground">
                            {service.appDir} · 启动命令 {service.run.command}
                            {typeof service.run.port === 'number'
                              ? ` · port ${service.run.port}`
                              : ''}
                          </div>
                        </div>
                        <Badge variant="secondary" className="max-w-full break-words text-left">
                          {getServiceRuntimeSummary(service)}
                        </Badge>
                      </div>

                      {!service.disabled && (
                        <div className="mt-4 space-y-4 pl-11">
                          {service.type === 'web' && (
                            <div className="flex items-center justify-between rounded-[14px] bg-[rgba(15,23,42,0.03)] px-4 py-3">
                              <div>
                                <div className="text-sm font-medium">公网入口</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  决定是否对外暴露。
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
            </DisclosurePanel>

            <DisclosurePanel
              title="数据库设置"
              meta={`${formData.databases.length} 个`}
              open={reviewDatabasesOpen}
              onToggle={() => setReviewDatabasesOpen((current) => !current)}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {DATABASE_TYPE_OPTIONS.map((databaseType) => (
                    <Button
                      key={databaseType.value}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full px-3"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          databases: [...prev.databases, createDatabaseDraft(databaseType.value)],
                        }))
                      }
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {databaseType.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {formData.databases.length === 0 ? (
                  <div className="overflow-hidden rounded-[18px] bg-[rgba(15,23,42,0.03)]">
                    <EmptyState
                      icon={<Database className="h-5 w-5 opacity-40" />}
                      title="没有数据库"
                      className="min-h-40 rounded-none"
                    />
                  </div>
                ) : (
                  formData.databases.map((database) => {
                    const updateDatabase = (updates: Partial<DatabaseWithId>) => {
                      setFormData((prev) => ({
                        ...prev,
                        databases: prev.databases.map((item) =>
                          item._id === database._id ? { ...item, ...updates } : item
                        ),
                      }));
                    };

                    return (
                      <div key={database._id} className={reviewSubtleClassName}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <Input
                              value={database.name}
                              onChange={(event) => updateDatabase({ name: event.target.value })}
                              className="h-9 w-44 min-w-0"
                            />
                            <Badge variant="secondary">
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
                              ).map((option) => {
                                const disabled = !supportsDatabaseProvisionType(
                                  database.type,
                                  option.value
                                );

                                return (
                                  <Button
                                    key={option.value}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() => updateDatabase({ provisionType: option.value })}
                                    className={getPillChoiceClass(
                                      database.provisionType === option.value,
                                      disabled
                                    )}
                                  >
                                    {option.label}
                                  </Button>
                                );
                              })}
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
                                  : database.type === 'mysql'
                                    ? 'mysql://user:pass@host:3306/db'
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
            </DisclosurePanel>
          </div>
        )}
      </div>

      <div className="pointer-events-none sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 mt-6 -mx-4 px-4 py-3 md:static md:mx-0 md:px-0 md:py-0">
        <div
          className={cn(
            reviewShellClassName,
            'pointer-events-auto flex items-center justify-between gap-3 p-3 md:bg-transparent md:p-0 md:shadow-none'
          )}
        >
          <Button
            variant="ghost"
            className="rounded-full px-4"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一步
          </Button>

          {isLastStep ? (
            <Button
              className="px-4"
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
            >
              {isSubmitting ? '创建中...' : '创建项目'}
            </Button>
          ) : (
            <Button className="px-4" onClick={handleNext} disabled={!canProceed()}>
              下一步
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
