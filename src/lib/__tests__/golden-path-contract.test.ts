import { describe, expect, it } from 'bun:test';
import {
  buildInitialAutoDeploySummary,
  resolveInitialAutoDeployRefs,
} from '@/lib/projects/initial-auto-deploy';
import { projectInitImportSteps } from '@/lib/queue/project-init-steps';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { resolveReleaseDeploymentResolution } from '@/lib/releases/state-machine';

describe('platform golden path contract', () => {
  it('导入项目必须以首发构建收尾', () => {
    expect(projectInitImportSteps).toEqual([
      'validate_repository',
      'push_cicd_config',
      'configure_release_trigger',
      'setup_namespace',
      'provision_databases',
      'deploy_services',
      'configure_dns',
      'trigger_initial_builds',
    ]);
  });

  it('首发构建只触发持久环境自动部署分支', () => {
    const refs = resolveInitialAutoDeployRefs([
      { branch: 'main', autoDeploy: true, isPreview: false },
      { branch: 'staging', autoDeploy: true, isPreview: false },
      { branch: 'feature/a', autoDeploy: true, isPreview: true },
      { branch: 'main', autoDeploy: true, isPreview: false },
    ]);

    expect(refs).toEqual(['refs/heads/main', 'refs/heads/staging']);
    expect(
      buildInitialAutoDeploySummary({
        refs,
        triggeredRefs: ['refs/heads/main'],
        missingRefs: ['refs/heads/staging'],
      })
    ).toBe('已触发 1 个首发构建，跳过不存在的分支：staging');
  });

  it('生产受控放量必须停在 release detail 的用户动作上', () => {
    expect(
      resolveReleaseDeploymentResolution([
        {
          id: 'deployment_1',
          status: 'awaiting_rollout',
        },
      ])
    ).toEqual({ kind: 'awaiting_rollout' });

    expect(buildReleaseDetailPath('project_1', 'env_prod', 'release_1')).toBe(
      '/projects/project_1/environments/env_prod/delivery/release_1'
    );
  });
});
