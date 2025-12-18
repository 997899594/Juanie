import { Injectable } from '@nestjs/common'
import * as yaml from 'yaml'

export interface GitRepositoryInput {
  name: string
  namespace: string
  url: string
  branch?: string
  interval?: string
  secretRef?: string
  timeout?: string
}

export interface KustomizationInput {
  name: string
  namespace: string
  gitRepositoryName: string
  path?: string
  interval?: string
  prune?: boolean
  timeout?: string
  retryInterval?: string
  healthChecks?: Array<{
    apiVersion: string
    kind: string
    name: string
    namespace?: string
  }>
  dependsOn?: Array<{
    name: string
    namespace?: string
  }>
}

export interface HelmReleaseInput {
  name: string
  namespace: string
  interval?: string
  chartName: string
  chartVersion?: string
  sourceType: 'GitRepository' | 'HelmRepository'
  sourceName: string
  sourceNamespace?: string
  values?: Record<string, any>
  valuesFrom?: Array<{
    kind: string
    name: string
    valuesKey?: string
  }>
  install?: {
    remediation?: { retries: number }
    createNamespace?: boolean
  }
  upgrade?: {
    remediation?: { retries: number; remediateLastFailure?: boolean }
    cleanupOnFail?: boolean
  }
}

@Injectable()
export class YamlGeneratorService {
  /**
   * 生成 GitRepository 资源的 YAML
   * GitRepository 定义了 Git 仓库源，Flux 会定期从这个源拉取配置
   */
  generateGitRepositoryYAML(input: GitRepositoryInput): string {
    const resource: any = {
      apiVersion: 'source.toolkit.fluxcd.io/v1',
      kind: 'GitRepository',
      metadata: {
        name: input.name,
        namespace: input.namespace,
        annotations: {
          // 触发立即 reconcile，避免等待 Flux 的默认扫描间隔
          'reconcile.fluxcd.io/requestedAt': new Date().toISOString(),
        },
      },
      spec: {
        interval: input.interval || '1m',
        url: input.url,
        ref: {
          branch: input.branch || 'main',
        },
      },
    }

    // 添加可选字段
    if (input.secretRef) {
      resource.spec.secretRef = {
        name: input.secretRef,
      }
    }

    if (input.timeout) {
      resource.spec.timeout = input.timeout
    }

    // 限制重试次数，避免失败资源无限重试
    resource.spec.suspend = false

    return yaml.stringify(resource, {
      lineWidth: 0, // 禁用自动换行
      indent: 2,
    })
  }

  /**
   * 生成 Kustomization 资源的 YAML
   * Kustomization 定义了如何应用 Git 仓库中的 Kubernetes 清单
   */
  generateKustomizationYAML(input: KustomizationInput): string {
    const resource: any = {
      apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
      kind: 'Kustomization',
      metadata: {
        name: input.name,
        namespace: input.namespace,
        annotations: {
          // 触发立即 reconcile，避免等待 Flux 的默认扫描间隔
          'reconcile.fluxcd.io/requestedAt': new Date().toISOString(),
        },
      },
      spec: {
        interval: input.interval || '5m',
        path: input.path || './',
        prune: input.prune !== false, // 默认启用 prune（删除不在 Git 中的资源）
        sourceRef: {
          kind: 'GitRepository',
          name: input.gitRepositoryName,
        },
      },
    }

    // 添加可选字段
    if (input.timeout) {
      resource.spec.timeout = input.timeout
    }

    if (input.retryInterval) {
      resource.spec.retryInterval = input.retryInterval
    }

    // 添加健康检查
    if (input.healthChecks && input.healthChecks.length > 0) {
      resource.spec.healthChecks = input.healthChecks.map((hc) => {
        const check: any = {
          apiVersion: hc.apiVersion,
          kind: hc.kind,
          name: hc.name,
        }
        if (hc.namespace) {
          check.namespace = hc.namespace
        }
        return check
      })
    }

    // 添加依赖关系
    if (input.dependsOn && input.dependsOn.length > 0) {
      resource.spec.dependsOn = input.dependsOn.map((dep) => {
        const dependency: any = {
          name: dep.name,
        }
        if (dep.namespace) {
          dependency.namespace = dep.namespace
        }
        return dependency
      })
    }

    return yaml.stringify(resource, {
      lineWidth: 0,
      indent: 2,
    })
  }

  /**
   * 生成 HelmRelease 资源的 YAML
   * HelmRelease 定义了如何部署和管理 Helm Chart
   */
  generateHelmReleaseYAML(input: HelmReleaseInput): string {
    const resource: any = {
      apiVersion: 'helm.toolkit.fluxcd.io/v2',
      kind: 'HelmRelease',
      metadata: {
        name: input.name,
        namespace: input.namespace,
      },
      spec: {
        interval: input.interval || '5m',
        chart: {
          spec: {
            chart: input.chartName,
            version: input.chartVersion || '*',
            sourceRef: {
              kind: input.sourceType,
              name: input.sourceName,
            },
          },
        },
      },
    }

    // 添加源的命名空间（如果指定）
    if (input.sourceNamespace) {
      resource.spec.chart.spec.sourceRef.namespace = input.sourceNamespace
    }

    // 添加 values（内联值）
    if (input.values && Object.keys(input.values).length > 0) {
      resource.spec.values = input.values
    }

    // 添加 valuesFrom（从 ConfigMap 或 Secret 引用值）
    if (input.valuesFrom && input.valuesFrom.length > 0) {
      resource.spec.valuesFrom = input.valuesFrom.map((vf) => {
        const valuesFrom: any = {
          kind: vf.kind,
          name: vf.name,
        }
        if (vf.valuesKey) {
          valuesFrom.valuesKey = vf.valuesKey
        }
        return valuesFrom
      })
    }

    // 添加安装配置
    if (input.install) {
      resource.spec.install = {}
      if (input.install.remediation) {
        resource.spec.install.remediation = {
          retries: input.install.remediation.retries,
        }
      }
      if (input.install.createNamespace !== undefined) {
        resource.spec.install.createNamespace = input.install.createNamespace
      }
    } else {
      // 默认安装配置
      resource.spec.install = {
        remediation: {
          retries: 3,
        },
      }
    }

    // 添加升级配置
    if (input.upgrade) {
      resource.spec.upgrade = {}
      if (input.upgrade.remediation) {
        resource.spec.upgrade.remediation = {
          retries: input.upgrade.remediation.retries,
        }
        if (input.upgrade.remediation.remediateLastFailure !== undefined) {
          resource.spec.upgrade.remediation.remediateLastFailure =
            input.upgrade.remediation.remediateLastFailure
        }
      }
      if (input.upgrade.cleanupOnFail !== undefined) {
        resource.spec.upgrade.cleanupOnFail = input.upgrade.cleanupOnFail
      }
    } else {
      // 默认升级配置
      resource.spec.upgrade = {
        remediation: {
          retries: 3,
          remediateLastFailure: true,
        },
        cleanupOnFail: true,
      }
    }

    return yaml.stringify(resource, {
      lineWidth: 0,
      indent: 2,
    })
  }

  /**
   * 生成 Kubernetes Secret 用于 Git 认证
   * 支持 HTTPS（用户名/密码）和 SSH（私钥）两种方式
   */
  generateGitSecretYAML(data: {
    name: string
    namespace: string
    username?: string
    password?: string
    sshPrivateKey?: string
    knownHosts?: string
  }): string {
    const resource: any = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: data.name,
        namespace: data.namespace,
      },
    }

    // SSH 认证
    if (data.sshPrivateKey) {
      resource.type = 'Opaque'
      resource.stringData = {
        identity: data.sshPrivateKey,
        'identity.pub': '', // 可选
        known_hosts: data.knownHosts || '',
      }
    }
    // HTTPS 认证
    else if (data.username && data.password) {
      resource.type = 'kubernetes.io/basic-auth'
      resource.stringData = {
        username: data.username,
        password: data.password,
      }
    } else {
      throw new Error('必须提供 SSH 私钥或用户名/密码')
    }

    return yaml.stringify(resource, {
      lineWidth: 0,
      indent: 2,
    })
  }

  /**
   * 生成 Flux Notification Provider
   * 用于配置 Flux 事件通知的目标（Webhook）
   */
  generateNotificationProviderYAML(data: {
    name: string
    namespace: string
    type: 'generic' | 'slack' | 'discord' | 'msteams'
    address: string
    secretRef?: string
  }): string {
    const resource: any = {
      apiVersion: 'notification.toolkit.fluxcd.io/v1',
      kind: 'Provider',
      metadata: {
        name: data.name,
        namespace: data.namespace,
      },
      spec: {
        type: data.type,
        address: data.address,
      },
    }

    if (data.secretRef) {
      resource.spec.secretRef = {
        name: data.secretRef,
      }
    }

    return yaml.stringify(resource, {
      lineWidth: 0,
      indent: 2,
    })
  }

  /**
   * 生成 Flux Alert
   * 定义哪些事件应该发送到哪个 Provider
   */
  generateAlertYAML(data: {
    name: string
    namespace: string
    providerRef: string
    eventSeverity?: 'info' | 'error'
    eventSources: Array<{
      kind: string
      name?: string
      namespace?: string
    }>
  }): string {
    const resource: any = {
      apiVersion: 'notification.toolkit.fluxcd.io/v1',
      kind: 'Alert',
      metadata: {
        name: data.name,
        namespace: data.namespace,
      },
      spec: {
        providerRef: {
          name: data.providerRef,
        },
        eventSeverity: data.eventSeverity || 'info',
        eventSources: data.eventSources.map((source) => {
          const eventSource: any = {
            kind: source.kind,
            name: source.name || '*',
          }
          if (source.namespace) {
            eventSource.namespace = source.namespace
          }
          return eventSource
        }),
      },
    }

    return yaml.stringify(resource, {
      lineWidth: 0,
      indent: 2,
    })
  }

  /**
   * 合并多个 YAML 文档
   * 用于批量创建资源
   */
  combineYAMLDocuments(yamls: string[]): string {
    return yamls.join('\n---\n')
  }

  /**
   * 解析 YAML 字符串为对象
   */
  parseYAML(yamlString: string): any {
    return yaml.parse(yamlString)
  }

  /**
   * 验证 YAML 语法
   */
  validateYAML(yamlString: string): { valid: boolean; error?: string } {
    try {
      yaml.parse(yamlString)
      return { valid: true }
    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      }
    }
  }
}
