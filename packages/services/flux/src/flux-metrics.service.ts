import { Injectable } from '@nestjs/common'
import { metrics } from '@opentelemetry/api'

/**
 * Flux 指标收集服务
 * 收集 GitOps 相关的 Prometheus 指标
 */
@Injectable()
export class FluxMetricsService {
  private readonly meter = metrics.getMeter('flux-service')

  // GitRepository 同步指标
  readonly gitRepositorySyncCounter = this.meter.createCounter('flux.git_repository.sync.total', {
    description: 'Total number of GitRepository sync operations',
    unit: '1',
  })

  readonly gitRepositorySyncDuration = this.meter.createHistogram(
    'flux.git_repository.sync.duration',
    {
      description: 'GitRepository sync duration in seconds',
      unit: 's',
    },
  )

  readonly gitRepositorySyncErrors = this.meter.createCounter('flux.git_repository.sync.errors', {
    description: 'Total number of GitRepository sync errors',
    unit: '1',
  })

  // Kustomization 应用指标
  readonly kustomizationApplyCounter = this.meter.createCounter('flux.kustomization.apply.total', {
    description: 'Total number of Kustomization apply operations',
    unit: '1',
  })

  readonly kustomizationApplyDuration = this.meter.createHistogram(
    'flux.kustomization.apply.duration',
    {
      description: 'Kustomization apply duration in seconds',
      unit: 's',
    },
  )

  readonly kustomizationApplyErrors = this.meter.createCounter('flux.kustomization.apply.errors', {
    description: 'Total number of Kustomization apply errors',
    unit: '1',
  })

  // HelmRelease 指标
  readonly helmReleaseInstallCounter = this.meter.createCounter('flux.helm_release.install.total', {
    description: 'Total number of HelmRelease install operations',
    unit: '1',
  })

  readonly helmReleaseUpgradeCounter = this.meter.createCounter('flux.helm_release.upgrade.total', {
    description: 'Total number of HelmRelease upgrade operations',
    unit: '1',
  })

  readonly helmReleaseDuration = this.meter.createHistogram('flux.helm_release.duration', {
    description: 'HelmRelease operation duration in seconds',
    unit: 's',
  })

  readonly helmReleaseErrors = this.meter.createCounter('flux.helm_release.errors', {
    description: 'Total number of HelmRelease errors',
    unit: '1',
  })

  // Git 操作指标
  readonly gitOperationCounter = this.meter.createCounter('flux.git.operations.total', {
    description: 'Total number of Git operations (commit, push, pull)',
    unit: '1',
  })

  readonly gitOperationDuration = this.meter.createHistogram('flux.git.operation.duration', {
    description: 'Git operation duration in seconds',
    unit: 's',
  })

  readonly gitOperationErrors = this.meter.createCounter('flux.git.operations.errors', {
    description: 'Total number of Git operation errors',
    unit: '1',
  })

  // 部署成功率指标
  readonly deploymentCounter = this.meter.createCounter('flux.deployments.total', {
    description: 'Total number of GitOps deployments',
    unit: '1',
  })

  readonly deploymentSuccessCounter = this.meter.createCounter('flux.deployments.success.total', {
    description: 'Total number of successful GitOps deployments',
    unit: '1',
  })

  readonly deploymentFailureCounter = this.meter.createCounter('flux.deployments.failure.total', {
    description: 'Total number of failed GitOps deployments',
    unit: '1',
  })

  readonly deploymentDuration = this.meter.createHistogram('flux.deployment.duration', {
    description: 'GitOps deployment duration in seconds',
    unit: 's',
  })

  // Flux 组件健康状态
  readonly fluxComponentHealth = this.meter.createUpDownCounter('flux.component.health', {
    description: 'Flux component health status (1 = healthy, 0 = unhealthy)',
    unit: '1',
  })

  // 活跃的 GitOps 资源数量
  readonly activeResourcesGauge = this.meter.createUpDownCounter('flux.resources.active', {
    description: 'Number of active GitOps resources',
    unit: '1',
  })

  // Reconciliation 指标
  readonly reconciliationCounter = this.meter.createCounter('flux.reconciliation.total', {
    description: 'Total number of Flux reconciliation operations',
    unit: '1',
  })

  readonly reconciliationDuration = this.meter.createHistogram('flux.reconciliation.duration', {
    description: 'Flux reconciliation duration in seconds',
    unit: 's',
  })

  /**
   * 记录 GitRepository 同步事件
   */
  recordGitRepositorySync(
    name: string,
    namespace: string,
    status: 'success' | 'failed',
    duration: number,
  ) {
    const attributes = {
      'resource.name': name,
      'resource.namespace': namespace,
      'sync.status': status,
    }

    this.gitRepositorySyncCounter.add(1, attributes)
    this.gitRepositorySyncDuration.record(duration, attributes)

    if (status === 'failed') {
      this.gitRepositorySyncErrors.add(1, attributes)
    }
  }

  /**
   * 记录 Kustomization 应用事件
   */
  recordKustomizationApply(
    name: string,
    namespace: string,
    status: 'success' | 'failed',
    duration: number,
  ) {
    const attributes = {
      'resource.name': name,
      'resource.namespace': namespace,
      'apply.status': status,
    }

    this.kustomizationApplyCounter.add(1, attributes)
    this.kustomizationApplyDuration.record(duration, attributes)

    if (status === 'failed') {
      this.kustomizationApplyErrors.add(1, attributes)
    }
  }

  /**
   * 记录 HelmRelease 事件
   */
  recordHelmRelease(
    name: string,
    namespace: string,
    operation: 'install' | 'upgrade',
    status: 'success' | 'failed',
    duration: number,
  ) {
    const attributes = {
      'resource.name': name,
      'resource.namespace': namespace,
      'helm.operation': operation,
      'helm.status': status,
    }

    if (operation === 'install') {
      this.helmReleaseInstallCounter.add(1, attributes)
    } else {
      this.helmReleaseUpgradeCounter.add(1, attributes)
    }

    this.helmReleaseDuration.record(duration, attributes)

    if (status === 'failed') {
      this.helmReleaseErrors.add(1, attributes)
    }
  }

  /**
   * 记录 Git 操作
   */
  recordGitOperation(
    operation: 'commit' | 'push' | 'pull' | 'clone',
    repository: string,
    status: 'success' | 'failed',
    duration: number,
  ) {
    const attributes = {
      'git.operation': operation,
      'git.repository': repository,
      'git.status': status,
    }

    this.gitOperationCounter.add(1, attributes)
    this.gitOperationDuration.record(duration, attributes)

    if (status === 'failed') {
      this.gitOperationErrors.add(1, attributes)
    }
  }

  /**
   * 记录部署事件
   */
  recordDeployment(
    projectId: string,
    environmentId: string,
    method: 'gitops-ui' | 'gitops-git',
    status: 'success' | 'failed',
    duration: number,
  ) {
    const attributes = {
      'deployment.project_id': projectId,
      'deployment.environment_id': environmentId,
      'deployment.method': method,
      'deployment.status': status,
    }

    this.deploymentCounter.add(1, attributes)

    if (status === 'success') {
      this.deploymentSuccessCounter.add(1, attributes)
    } else {
      this.deploymentFailureCounter.add(1, attributes)
    }

    this.deploymentDuration.record(duration, attributes)
  }

  /**
   * 更新 Flux 组件健康状态
   */
  updateComponentHealth(component: string, healthy: boolean) {
    const attributes = {
      'component.name': component,
    }

    // 使用 UpDownCounter: 1 表示健康，0 表示不健康
    this.fluxComponentHealth.add(healthy ? 1 : -1, attributes)
  }

  /**
   * 更新活跃资源数量
   */
  updateActiveResources(type: 'kustomization' | 'helm', delta: number) {
    const attributes = {
      'resource.type': type,
    }

    this.activeResourcesGauge.add(delta, attributes)
  }

  /**
   * 记录 Reconciliation 事件
   */
  recordReconciliation(
    kind: string,
    name: string,
    namespace: string,
    status: 'success' | 'failed',
    duration: number,
  ) {
    const attributes = {
      'resource.kind': kind,
      'resource.name': name,
      'resource.namespace': namespace,
      'reconciliation.status': status,
    }

    this.reconciliationCounter.add(1, attributes)
    this.reconciliationDuration.record(duration, attributes)
  }
}
