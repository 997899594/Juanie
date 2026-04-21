import type { InitStepStatus } from '@/lib/db/schema';

export const projectInitImportSteps = [
  'validate_repository',
  'push_cicd_config',
  'configure_release_trigger',
  'setup_namespace',
  'provision_databases',
  'deploy_services',
  'configure_dns',
] as const;

export const projectInitCreateSteps = [
  'create_repository',
  'push_template',
  'push_cicd_config',
  'configure_release_trigger',
  'setup_namespace',
  'provision_databases',
  'deploy_services',
  'configure_dns',
] as const;

export const projectInitStepsByMode = {
  import: projectInitImportSteps,
  create: projectInitCreateSteps,
} as const;

export type ProjectInitMode = keyof typeof projectInitStepsByMode;
export type ProjectInitStepName =
  | (typeof projectInitImportSteps)[number]
  | (typeof projectInitCreateSteps)[number];

export type ProjectInitErrorCode =
  | 'repository_missing'
  | 'repository_access_denied'
  | 'repository_create_denied'
  | 'repository_create_failed'
  | 'template_push_failed'
  | 'cicd_config_push_failed'
  | 'release_trigger_failed'
  | 'k8s_namespace_failed'
  | 'database_provision_failed'
  | 'service_deploy_failed'
  | 'dns_config_failed'
  | 'init_step_failed';

export const projectInitK8sExecutionSteps = [
  'deploy_services',
  'provision_databases',
  'configure_dns',
] as const satisfies readonly ProjectInitStepName[];

export const projectInitDefaultErrorCodes = {
  validate_repository: 'init_step_failed',
  create_repository: 'repository_create_failed',
  push_template: 'template_push_failed',
  push_cicd_config: 'cicd_config_push_failed',
  configure_release_trigger: 'release_trigger_failed',
  setup_namespace: 'k8s_namespace_failed',
  provision_databases: 'database_provision_failed',
  deploy_services: 'service_deploy_failed',
  configure_dns: 'dns_config_failed',
} as const satisfies Record<ProjectInitStepName, ProjectInitErrorCode>;

const autoRetryableProjectInitErrorCodes = [
  'k8s_namespace_failed',
  'database_provision_failed',
  'service_deploy_failed',
  'dns_config_failed',
  'init_step_failed',
] as const satisfies readonly ProjectInitErrorCode[];

export function getProjectInitSteps(mode: ProjectInitMode): readonly ProjectInitStepName[] {
  return projectInitStepsByMode[mode];
}

export function buildProjectInitStepSeeds(mode: ProjectInitMode): Array<{
  step: ProjectInitStepName;
  status: InitStepStatus;
  progress: number;
}> {
  return getProjectInitSteps(mode).map((step) => ({
    step,
    status: 'pending',
    progress: 0,
  }));
}

export function isK8sBackedProjectInitStep(step: ProjectInitStepName): boolean {
  return (projectInitK8sExecutionSteps as readonly string[]).includes(step);
}

export function isAutoRetryableProjectInitError(code: ProjectInitErrorCode): boolean {
  return (autoRetryableProjectInitErrorCodes as readonly string[]).includes(code);
}
