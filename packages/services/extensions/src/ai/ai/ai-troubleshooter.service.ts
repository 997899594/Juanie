import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { ConfigService } from '@nestjs/config'
import { desc, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Ollama } from 'ollama'

/**
 * 诊断结果
 */
export interface Diagnosis {
  problem: string
  rootCause: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedComponents: string[]
  recommendations: Array<{
    title: string
    description: string
    steps: string[]
    code?: string
  }>
  relatedLogs: string[]
  estimatedFixTime: string
}

/**
 * AI 故障诊断服务
 * 使用 AI 分析日志和指标，诊断问题并提供修复建议
 */
@Injectable()
export class AITroubleshooter {
  private readonly logger = new Logger(AITroubleshooter.name)
  private ollama: Ollama
  private readonly model = 'codellama'

  private readonly TROUBLESHOOTING_PROMPT =
    `You are a DevOps expert specializing in troubleshooting Kubernetes and application issues.

Analyze the provided information and provide a diagnosis in JSON format:
{
  "problem": "Clear description of the problem",
  "rootCause": "Root cause analysis",
  "severity": "low|medium|high|critical",
  "affectedComponents": ["component1", "component2"],
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed description",
      "steps": ["step1", "step2"],
      "code": "Example code or command (optional)"
    }
  ],
  "relatedLogs": ["relevant log entries"],
  "estimatedFixTime": "Estimated time to fix"
}

Focus on:
- Practical solutions
- Step-by-step instructions
- Common pitfalls
- Best practices`

  constructor(
    private readonly config: ConfigService,
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  ) {
    const ollamaHost = this.config.get<string>('OLLAMA_HOST') || 'http://localhost:11434'
    this.ollama = new Ollama({ host: ollamaHost })
  }

  /**
   * 诊断项目问题
   */
  async diagnose(projectId: string, symptoms: string): Promise<Diagnosis> {
    this.logger.log(`Diagnosing project ${projectId}: ${symptoms}`)

    try {
      // 1. 收集项目信息
      const projectInfo = await this.collectProjectInfo(projectId)

      // 2. 收集日志
      const logs = await this.collectLogs(projectId)

      // 3. 收集指标
      const metrics = await this.collectMetrics(projectId)

      // 4. 构建诊断 prompt
      const prompt = this.buildDiagnosisPrompt(symptoms, projectInfo, logs, metrics)

      // 5. AI 分析
      const response = await this.ollama.generate({
        model: this.model,
        prompt,
        system: this.TROUBLESHOOTING_PROMPT,
        options: {
          temperature: 0.4,
          top_p: 0.9,
        },
      })

      // 6. 解析诊断结果
      const diagnosis = this.parseDiagnosis(response.response)

      this.logger.log(`Diagnosis completed: ${diagnosis.severity} severity`)

      return diagnosis
    } catch (error) {
      this.logger.error('Failed to diagnose:', error)
      throw new Error(`Diagnosis failed: ${error}`)
    }
  }

  /**
   * 收集项目信息
   */
  private async collectProjectInfo(projectId: string): Promise<any> {
    try {
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      if (!project) {
        return null
      }

      // 获取环境信息
      const environments = await this.db
        .select()
        .from(schema.environments)
        .where(eq(schema.environments.projectId, projectId))

      // 获取部署信息
      const deployments = await this.db
        .select()
        .from(schema.deployments)
        .where(eq(schema.deployments.projectId, projectId))
        .orderBy(desc(schema.deployments.createdAt))
        .limit(5)

      return {
        project: {
          name: project.name,
          status: project.status,
          initializationStatus: project.initializationStatus,
        },
        environments: environments.map((e) => ({
          name: e.name,
          type: e.type,
        })),
        recentDeployments: deployments.map((d) => ({
          status: d.status,
          environment: d.environmentId,
          createdAt: d.createdAt,
        })),
      }
    } catch (error) {
      this.logger.error('Failed to collect project info:', error)
      return null
    }
  }

  /**
   * 收集日志
   */
  private async collectLogs(projectId: string): Promise<string[]> {
    try {
      // 从审计日志中获取最近的错误
      const auditLogs = await this.db
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.resourceId, projectId))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(20)

      return auditLogs
        .filter((log) => log.action.includes('error') || log.action.includes('failed'))
        .map(
          (log) =>
            `[${log.createdAt.toISOString()}] ${log.action}: ${JSON.stringify(log.metadata)}`,
        )
    } catch (error) {
      this.logger.error('Failed to collect logs:', error)
      return []
    }
  }

  /**
   * 收集指标
   */
  private async collectMetrics(projectId: string): Promise<any> {
    try {
      // 获取最近的部署统计
      const deployments = await this.db
        .select()
        .from(schema.deployments)
        .where(eq(schema.deployments.projectId, projectId))
        .orderBy(desc(schema.deployments.createdAt))
        .limit(10)

      const successCount = deployments.filter((d) => d.status === 'success').length
      const failureCount = deployments.filter((d) => d.status === 'failed').length
      const successRate = deployments.length > 0 ? (successCount / deployments.length) * 100 : 0

      return {
        deployments: {
          total: deployments.length,
          success: successCount,
          failed: failureCount,
          successRate: `${successRate.toFixed(1)}%`,
        },
        lastDeployment: deployments[0]
          ? {
              status: deployments[0].status,
              createdAt: deployments[0].createdAt,
            }
          : null,
      }
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error)
      return {}
    }
  }

  /**
   * 构建诊断 prompt
   */
  private buildDiagnosisPrompt(
    symptoms: string,
    projectInfo: Record<string, unknown>,
    logs: string[],
    metrics: Record<string, unknown>,
  ): string {
    return `Diagnose the following issue:

**Symptoms:**
${symptoms}

**Project Information:**
${JSON.stringify(projectInfo, null, 2)}

**Recent Logs:**
${logs.slice(0, 10).join('\n')}

**Metrics:**
${JSON.stringify(metrics, null, 2)}

Provide a comprehensive diagnosis with actionable recommendations.`
  }

  /**
   * 解析诊断结果
   */
  private parseDiagnosis(response: string): Diagnosis {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/```(?:json)?\n([\s\S]*?)\n```/)
      const jsonStr = jsonMatch?.[1] || response

      const diagnosis = JSON.parse(jsonStr)

      // 验证必需字段
      if (!diagnosis.problem || !diagnosis.rootCause) {
        throw new Error('Invalid diagnosis format')
      }

      return {
        problem: diagnosis.problem,
        rootCause: diagnosis.rootCause,
        severity: diagnosis.severity || 'medium',
        affectedComponents: diagnosis.affectedComponents || [],
        recommendations: diagnosis.recommendations || [],
        relatedLogs: diagnosis.relatedLogs || [],
        estimatedFixTime: diagnosis.estimatedFixTime || 'Unknown',
      }
    } catch (error) {
      this.logger.warn('Failed to parse diagnosis, using fallback:', error)

      // 返回基础诊断
      return {
        problem: 'Unable to parse AI diagnosis',
        rootCause: 'AI response format error',
        severity: 'medium',
        affectedComponents: [],
        recommendations: [
          {
            title: 'Manual Investigation Required',
            description: 'Please check logs and metrics manually',
            steps: ['Check application logs', 'Review deployment history', 'Verify configuration'],
          },
        ],
        relatedLogs: [],
        estimatedFixTime: 'Unknown',
      }
    }
  }

  /**
   * 快速诊断（基于常见问题模式）
   */
  async quickDiagnose(projectId: string): Promise<{
    issues: Array<{
      type: string
      severity: string
      message: string
      suggestion: string
    }>
  }> {
    const issues: Array<{
      type: string
      severity: string
      message: string
      suggestion: string
    }> = []

    try {
      // 检查最近的部署失败
      const recentDeployments = await this.db
        .select()
        .from(schema.deployments)
        .where(eq(schema.deployments.projectId, projectId))
        .orderBy(desc(schema.deployments.createdAt))
        .limit(5)

      const failedDeployments = recentDeployments.filter((d) => d.status === 'failed')

      if (failedDeployments.length > 0) {
        issues.push({
          type: 'deployment_failure',
          severity: 'high',
          message: `${failedDeployments.length} recent deployment(s) failed`,
          suggestion: 'Check deployment logs and configuration',
        })
      }

      // 检查项目健康状态
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      // 检查项目状态
      if (project?.status === 'failed') {
        issues.push({
          type: 'project_failed',
          severity: 'critical',
          message: 'Project is in failed state',
          suggestion: 'Check initialization status and logs for errors',
        })
      }

      // 检查 GitOps 同步状态
      const gitopsResources = await this.db
        .select()
        .from(schema.gitopsResources)
        .where(eq(schema.gitopsResources.projectId, projectId))

      const failedSync = gitopsResources.filter((r) => r.status === 'failed')

      if (failedSync.length > 0) {
        issues.push({
          type: 'gitops_sync_failure',
          severity: 'medium',
          message: `${failedSync.length} GitOps resource(s) failed to sync`,
          suggestion: 'Check Git repository access and Flux CD status',
        })
      }
    } catch (error) {
      this.logger.error('Failed to quick diagnose:', error)
    }

    return { issues }
  }
}
