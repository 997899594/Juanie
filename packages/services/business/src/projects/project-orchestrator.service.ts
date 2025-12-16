import type { CreateProjectInput } from '@juanie/types'
import { Logger } from '@juanie/core/logger'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import {
  CreateEnvironmentsHandler,
  CreateProjectHandler,
  FinalizeHandler,
  type InitializationContext,
  type InitializationResult,
  LoadTemplateHandler,
  ProjectInitializationStateMachine,
  RenderTemplateHandler,
  SetupRepositoryHandler,
} from './initialization'

/**
 * ProjectOrchestrator 服务 (重构版)
 *
 * 职责：
 * 1. 创建初始化上下文
 * 2. 委托给状态机执行
 * 3. 处理结果
 *
 * 优势：
 * - 代码简洁（< 100 行）
 * - 职责单一
 * - 易于测试
 * - 易于扩展
 */
@Injectable()
export class ProjectOrchestrator implements OnModuleInit {

  constructor(
    private stateMachine: ProjectInitializationStateMachine,
    private createProjectHandler: CreateProjectHandler,
    private loadTemplateHandler: LoadTemplateHandler,
    private renderTemplateHandler: RenderTemplateHandler,
    private createEnvironmentsHandler: CreateEnvironmentsHandler,
    private setupRepositoryHandler: SetupRepositoryHandler,
    private finalizeHandler: FinalizeHandler,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(ProjectOrchestrator.name)}

  onModuleInit() {
    // 注册所有状态处理器
    this.stateMachine.registerHandler(this.createProjectHandler)
    this.stateMachine.registerHandler(this.loadTemplateHandler)
    this.stateMachine.registerHandler(this.renderTemplateHandler)
    this.stateMachine.registerHandler(this.createEnvironmentsHandler)
    this.stateMachine.registerHandler(this.setupRepositoryHandler)
    this.stateMachine.registerHandler(this.finalizeHandler)

    this.logger.info('ProjectOrchestrator initialized with state machine')
  }

  /**
   * 创建并初始化项目
   *
   * 这是唯一的公共方法，所有复杂性都被封装在状态机中
   * 支持简单创建（无模板/仓库）、模板创建和仓库创建
   */
  async createAndInitialize(
    userId: string,
    data: CreateProjectInput,
  ): Promise<InitializationResult> {
    this.logger.info(`Creating project: ${data.name}`)

    // 创建初始化上下文
    const context: InitializationContext = {
      userId,
      organizationId: data.organizationId,
      projectData: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        logoUrl: data.logoUrl,
        visibility: data.visibility,
      },
      templateId: data.templateId,
      templateConfig: data.templateConfig,
      repository: data.repository,
      currentState: 'IDLE',
      progress: 0,
    }

    // 执行状态机
    const result = await this.stateMachine.execute(context)

    if (result.success) {
      this.logger.info(`Project ${result.projectId} created successfully`)
    } else {
      this.logger.error(`Project creation failed: ${result.error}`)
    }

    return result
  }
}
