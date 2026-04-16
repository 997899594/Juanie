import type {
  DeliveryRuleKind,
  EnvironmentDatabaseStrategy,
  EnvironmentDeliveryMode,
  EnvironmentDeploymentStrategy,
  EnvironmentKind,
  PromotionFlowStrategy,
} from '@/lib/db/schema';

export type CreateEnvironmentTemplate =
  | 'preview_production'
  | 'staging_production_preview'
  | 'dev_test_staging_production_preview';

export interface CreateEnvironmentTemplateOption {
  value: CreateEnvironmentTemplate;
  label: string;
  description: string;
}

export interface EnvironmentTopologyBlueprint {
  environments: Array<{
    key: string;
    name: string;
    kind: EnvironmentKind;
    deliveryMode: EnvironmentDeliveryMode;
    branch: string | null;
    autoDeploy: boolean;
    isProduction: boolean;
    databaseStrategy: EnvironmentDatabaseStrategy;
    deploymentStrategy: EnvironmentDeploymentStrategy;
  }>;
  deliveryRules: Array<{
    environmentKey: string;
    kind: DeliveryRuleKind;
    pattern: string | null;
    priority: number;
    autoCreateEnvironment: boolean;
  }>;
  promotionFlows: Array<{
    sourceEnvironmentKey: string;
    targetEnvironmentKey: string;
    requiresApproval: boolean;
    strategy: PromotionFlowStrategy;
    isActive: boolean;
  }>;
  primaryEnvironmentKey: string;
  previewBaseEnvironmentKey: string;
}

export const createEnvironmentTemplates: CreateEnvironmentTemplateOption[] = [
  {
    value: 'preview_production',
    label: 'Preview + Production',
    description: '一个基础长期环境接收分支变更，再受控推广到 production。',
  },
  {
    value: 'staging_production_preview',
    label: 'Staging + Production + Preview',
    description: '推荐默认模板，主分支先进 staging，验证后再 promote 到 production。',
  },
  {
    value: 'dev_test_staging_production_preview',
    label: 'Dev + Test + Staging + Production + Preview',
    description: '适合成熟团队，支持多长期环境和更清晰的环境流转。',
  },
];

export function getCreateEnvironmentTemplateLabel(template: CreateEnvironmentTemplate): string {
  return createEnvironmentTemplates.find((option) => option.value === template)?.label ?? template;
}

export function buildEnvironmentTopologyBlueprint(input: {
  template?: CreateEnvironmentTemplate | null;
  productionBranch: string;
  autoDeploy: boolean;
  productionDeploymentStrategy: EnvironmentDeploymentStrategy;
  previewDatabaseStrategy: Extract<EnvironmentDatabaseStrategy, 'inherit' | 'isolated_clone'>;
}): EnvironmentTopologyBlueprint {
  const template = input.template ?? 'staging_production_preview';

  switch (template) {
    case 'preview_production':
      return {
        environments: [
          {
            key: 'mainline',
            name: 'mainline',
            kind: 'persistent',
            deliveryMode: 'direct',
            branch: input.productionBranch,
            autoDeploy: input.autoDeploy,
            isProduction: false,
            databaseStrategy: 'direct',
            deploymentStrategy: 'rolling',
          },
          {
            key: 'production',
            name: 'production',
            kind: 'production',
            deliveryMode: 'promote_only',
            branch: null,
            autoDeploy: false,
            isProduction: true,
            databaseStrategy: 'direct',
            deploymentStrategy: input.productionDeploymentStrategy,
          },
        ],
        deliveryRules: [
          {
            environmentKey: 'mainline',
            kind: 'branch',
            pattern: input.productionBranch,
            priority: 100,
            autoCreateEnvironment: false,
          },
          {
            environmentKey: 'mainline',
            kind: 'pull_request',
            pattern: '*',
            priority: 200,
            autoCreateEnvironment: true,
          },
        ],
        promotionFlows: [
          {
            sourceEnvironmentKey: 'mainline',
            targetEnvironmentKey: 'production',
            requiresApproval: true,
            strategy: 'reuse_release_artifacts',
            isActive: true,
          },
        ],
        primaryEnvironmentKey: 'mainline',
        previewBaseEnvironmentKey: 'mainline',
      };
    case 'dev_test_staging_production_preview':
      return {
        environments: [
          {
            key: 'dev',
            name: 'dev',
            kind: 'persistent',
            deliveryMode: 'direct',
            branch: 'develop',
            autoDeploy: true,
            isProduction: false,
            databaseStrategy: 'direct',
            deploymentStrategy: 'rolling',
          },
          {
            key: 'test',
            name: 'test',
            kind: 'persistent',
            deliveryMode: 'direct',
            branch: 'test',
            autoDeploy: true,
            isProduction: false,
            databaseStrategy: 'direct',
            deploymentStrategy: 'rolling',
          },
          {
            key: 'staging',
            name: 'staging',
            kind: 'persistent',
            deliveryMode: 'direct',
            branch: input.productionBranch,
            autoDeploy: input.autoDeploy,
            isProduction: false,
            databaseStrategy: 'direct',
            deploymentStrategy: 'rolling',
          },
          {
            key: 'production',
            name: 'production',
            kind: 'production',
            deliveryMode: 'promote_only',
            branch: null,
            autoDeploy: false,
            isProduction: true,
            databaseStrategy: 'direct',
            deploymentStrategy: input.productionDeploymentStrategy,
          },
        ],
        deliveryRules: [
          {
            environmentKey: 'dev',
            kind: 'branch',
            pattern: 'develop',
            priority: 100,
            autoCreateEnvironment: false,
          },
          {
            environmentKey: 'test',
            kind: 'branch',
            pattern: 'test',
            priority: 110,
            autoCreateEnvironment: false,
          },
          {
            environmentKey: 'staging',
            kind: 'branch',
            pattern: input.productionBranch,
            priority: 120,
            autoCreateEnvironment: false,
          },
          {
            environmentKey: 'staging',
            kind: 'pull_request',
            pattern: '*',
            priority: 200,
            autoCreateEnvironment: true,
          },
        ],
        promotionFlows: [
          {
            sourceEnvironmentKey: 'dev',
            targetEnvironmentKey: 'test',
            requiresApproval: false,
            strategy: 'reuse_release_artifacts',
            isActive: true,
          },
          {
            sourceEnvironmentKey: 'test',
            targetEnvironmentKey: 'staging',
            requiresApproval: false,
            strategy: 'reuse_release_artifacts',
            isActive: true,
          },
          {
            sourceEnvironmentKey: 'staging',
            targetEnvironmentKey: 'production',
            requiresApproval: true,
            strategy: 'reuse_release_artifacts',
            isActive: true,
          },
        ],
        primaryEnvironmentKey: 'staging',
        previewBaseEnvironmentKey: 'staging',
      };
    default:
      return {
        environments: [
          {
            key: 'staging',
            name: 'staging',
            kind: 'persistent',
            deliveryMode: 'direct',
            branch: input.productionBranch,
            autoDeploy: input.autoDeploy,
            isProduction: false,
            databaseStrategy: 'direct',
            deploymentStrategy: 'rolling',
          },
          {
            key: 'production',
            name: 'production',
            kind: 'production',
            deliveryMode: 'promote_only',
            branch: null,
            autoDeploy: false,
            isProduction: true,
            databaseStrategy: 'direct',
            deploymentStrategy: input.productionDeploymentStrategy,
          },
        ],
        deliveryRules: [
          {
            environmentKey: 'staging',
            kind: 'branch',
            pattern: input.productionBranch,
            priority: 100,
            autoCreateEnvironment: false,
          },
          {
            environmentKey: 'staging',
            kind: 'pull_request',
            pattern: '*',
            priority: 200,
            autoCreateEnvironment: true,
          },
        ],
        promotionFlows: [
          {
            sourceEnvironmentKey: 'staging',
            targetEnvironmentKey: 'production',
            requiresApproval: true,
            strategy: 'reuse_release_artifacts',
            isActive: true,
          },
        ],
        primaryEnvironmentKey: 'staging',
        previewBaseEnvironmentKey: 'staging',
      };
  }
}
