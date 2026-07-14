'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  formatUnsupportedPreviewCloneDatabasesMessage,
  getUnsupportedPreviewCloneDatabases,
} from '@/lib/databases/platform-support';
import type { TeamRole } from '@/lib/db/schema';
import type { DeliveryGraph, DeliveryGraphSummary } from '@/lib/delivery-graph/model';
import {
  getEnvironmentDatabaseStrategyLabel,
  getEnvironmentDeploymentStrategyLabel,
} from '@/lib/environments/presentation';
import { submitCreateProject } from '@/lib/projects/create-client-actions';
import type { CreateRuntimeProfile, CreateTemplateOption } from '@/lib/projects/create-defaults';
import {
  type AnalyzeRepositoryResponse,
  type AnalyzeServiceResponse,
  buildImportFallbackServices,
  buildTemplateServiceDrafts,
  type DatabaseWithId,
  getInitialVariableError,
  type InitialVariableWithId,
  isInitialVariableReady,
  normalizeService,
  normalizeVariableKey,
  type ServiceWithId,
  toServicePayload,
  withServiceIds,
} from '@/lib/projects/create-form-model';
import {
  type CreateEnvironmentTemplate,
  getCreateEnvironmentTemplateLabel,
} from '@/lib/projects/environment-topology';
import { getRepositoryDefaultBranch } from '@/lib/projects/refs';

export interface CreateProjectFormProps {
  teamScopes: Array<{
    id: string;
    name: string;
    slug: string;
    role: TeamRole;
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

export type CreateMode = 'import' | 'create';
export type CreateProjectStep = 'mode' | 'repository' | 'config' | 'review';

export interface CreateProjectFormData {
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
  initialVariables: InitialVariableWithId[];
  monorepoType: string;
  hasDockerBake: boolean;
  bakeTargets: string[];
  deliveryGraph: DeliveryGraph | null;
  deliveryGraphSummary: DeliveryGraphSummary | null;
}

export const CREATE_PROJECT_STEPS: Array<{ id: CreateProjectStep; title: string }> = [
  { id: 'mode', title: '模式' },
  { id: 'repository', title: '仓库' },
  { id: 'config', title: '配置' },
  { id: 'review', title: '确认' },
];

export function useCreateProjectForm({ teamScopes, templates }: CreateProjectFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<CreateProjectStep>('mode');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAnalyze, setIsLoadingAnalyze] = useState(false);

  const [formData, setFormData] = useState<CreateProjectFormData>({
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
    initialVariables: [],
    monorepoType: 'none',
    hasDockerBake: false,
    bakeTargets: [],
    deliveryGraph: null,
    deliveryGraphSummary: null,
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
  const [reviewVariablesOpen, setReviewVariablesOpen] = useState(false);
  const [reviewServicesOpen, setReviewServicesOpen] = useState(false);
  const [reviewDatabasesOpen, setReviewDatabasesOpen] = useState(false);

  const selectedTeam =
    teamScopes.find((team) => team.id === formData.teamId) ?? teamScopes[0] ?? null;
  const currentStepIndex = CREATE_PROJECT_STEPS.findIndex((step) => step.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === CREATE_PROJECT_STEPS.length - 1;
  const activeServices = formData.services.filter((service) => !service.disabled);
  const readyInitialVariables = formData.initialVariables.filter((variable) =>
    isInitialVariableReady(variable, formData.initialVariables)
  );
  const initialVariableErrors = formData.initialVariables
    .map((variable) => getInitialVariableError(variable, formData.initialVariables))
    .filter((error): error is string => Boolean(error));
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
            deliveryGraph: null,
            deliveryGraphSummary: null,
          }));
          return;
        }

        const data = (await response.json()) as AnalyzeRepositoryResponse;
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
          deliveryGraph: data.deliveryGraph,
          deliveryGraphSummary: data.summary,
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
          deliveryGraph: null,
          deliveryGraphSummary: null,
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
      deliveryGraph: prev.mode === 'import' ? null : prev.deliveryGraph,
      deliveryGraphSummary: prev.mode === 'import' ? null : prev.deliveryGraphSummary,
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
      deliveryGraph: null,
      deliveryGraphSummary: null,
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
      setCurrentStep(CREATE_PROJECT_STEPS[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(CREATE_PROJECT_STEPS[currentStepIndex - 1].id);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (formData.mode === 'import') {
      fetchRepositories(query);
    }
  };

  const selectRepository = async (repository: (typeof repositories)[0]) => {
    const defaultBranch = getRepositoryDefaultBranch(repository);

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
      productionBranch: defaultBranch,
    }));

    await analyzeRepository(repository.fullName, defaultBranch);
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
          capabilities: database.capabilities,
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
        initialVariables: readyInitialVariables.map((variable) => ({
          key: normalizeVariableKey(variable.key),
          value: variable.value,
          isSecret: variable.isSecret,
          injectionType: variable.injectionType,
        })),
      });

      if (result.ok) {
        router.push(`/projects/${result.project.id}/initializing`);
        return;
      }

      toast.error(result.snapshot.platformSignals.primarySummary ?? '创建项目失败，请稍后重试');
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
            formData.services.length > 0 &&
            initialVariableErrors.length === 0
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

  return {
    activeServices,
    canProceed,
    configAdvancedOpen,
    currentStep,
    currentStepIndex,
    deploymentStrategyLabel,
    environmentTemplateLabel,
    formData,
    handleBack,
    handleNext,
    handleSearch,
    handleSubmit,
    initialVariableErrors,
    isolatedCloneBlockedMessage,
    isFirstStep,
    isLastStep,
    isLoadingAnalyze,
    isSubmitting,
    previewDatabaseStrategyLabel,
    readyInitialVariables,
    repositories,
    reviewDatabasesOpen,
    reviewServicesOpen,
    reviewVariablesOpen,
    searchQuery,
    selectRepository,
    selectedTeam,
    setConfigAdvancedOpen,
    setFormData,
    setReviewDatabasesOpen,
    setReviewServicesOpen,
    setReviewVariablesOpen,
    switchMode,
    updateRuntimeProfile,
    updateService,
    updateTeamId,
  };
}

export type CreateProjectFormController = ReturnType<typeof useCreateProjectForm>;
