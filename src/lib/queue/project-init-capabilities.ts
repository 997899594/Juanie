import type { Capability } from '@/lib/integrations/domain/models';
import {
  getProjectInitSteps,
  type ProjectInitMode,
  type ProjectInitStepName,
} from './project-init-steps';

const stepCapabilityMap: Record<ProjectInitStepName, Capability[]> = {
  validate_repository: ['read_repo'],
  create_repository: ['write_repo'],
  push_template: ['write_repo', 'write_workflow'],
  push_cicd_config: ['write_repo', 'write_workflow'],
  configure_release_trigger: [],
  setup_namespace: [],
  provision_databases: [],
  deploy_services: [],
  configure_dns: [],
  trigger_initial_builds: ['read_repo', 'write_workflow'],
};

export function requiredCapabilitiesForStep(step: ProjectInitStepName): Capability[] {
  return stepCapabilityMap[step];
}

export function getRequiredCapabilitiesForProjectBootstrap(mode: ProjectInitMode): Capability[] {
  const capabilities = new Set<Capability>();

  for (const step of getProjectInitSteps(mode)) {
    for (const capability of requiredCapabilitiesForStep(step)) {
      capabilities.add(capability);
    }
  }

  // Bootstrap always inspects repository contents while generating Juanie-managed config.
  capabilities.add('read_repo');

  return [...capabilities];
}
