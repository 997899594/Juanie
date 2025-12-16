import * as schema from '@juanie/core/database'
import {
  EnvironmentCreationFailedError,
  FinalizationFailedError,
  ProjectCreationFailedError,
  ProjectInitializationError,
  RepositorySetupFailedError,
  TemplateLoadFailedError,
} from '@juanie/core/errors'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type {
  InitializationContext,
  InitializationEvent,
  InitializationResult,
  InitializationState,
  StateHandler,
} from './types'

/**
 * 项目初始化状态机
 *
 * 职责：
 * 1. 管理初始化流程的状态转换
 * 2. 协调各个状态处理器
 * 3. 处理错误和回滚
 * 4. 提供事务支持确保原子性
 */
@Injectable()
export class ProjectInitializationStateMachine {
  private handlers = new Map<InitializationState, StateHandler>()

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(ProjectInitializationStateMachine.name)}

  // 状态转换表
  private readonly transitions: Record<
    InitializationState,
    Partial<Record<InitializationEvent, InitializationState>>
  > = {
    IDLE: {
      START: 'CREATING_PROJECT',
    },
    CREATING_PROJECT: {
      PROJECT_CREATED: 'LOADING_TEMPLATE',
      ERROR: 'FAILED',
    },
    LOADING_TEMPLATE: {
      TEMPLATE_LOADED: 'RENDERING_TEMPLATE',
      ERROR: 'FAILED',
    },
    RENDERING_TEMPLATE: {
      TEMPLATE_RENDERED: 'CREATING_ENVIRONMENTS',
      ERROR: 'FAILED',
    },
    CREATING_ENVIRONMENTS: {
      ENVIRONMENTS_CREATED: 'SETTING_UP_REPOSITORY',
      ERROR: 'FAILED',
    },
    SETTING_UP_REPOSITORY: {
      REPOSITORY_READY: 'FINALIZING',
      ERROR: 'FAILED',
    },
    FINALIZING: {
      FINALIZED: 'COMPLETED',
      ERROR: 'FAILED',
    },
    COMPLETED: {},
    FAILED: {},
  }

  registerHandler(handler: StateHandler) {
    this.handlers.set(handler.name, handler)
  }

  /**
   * 执行初始化流程（带事务支持）
   */
  async execute(context: InitializationContext): Promise<InitializationResult> {
    this.logger.info(`Starting initialization for project: ${context.projectData.name}`)

    try {
      // 使用数据库事务包裹整个流程
      const result = await this.db.transaction(async (tx) => {
        // 注入事务到 context
        context.tx = tx

        // 触发开始事件
        await this.transition(context, 'START')

        // 执行状态机循环
        while (context.currentState !== 'COMPLETED' && context.currentState !== 'FAILED') {
          await this.executeCurrentState(context)
        }

        if (context.currentState === 'FAILED') {
          throw context.error || new Error('Initialization failed')
        }

        this.logger.info(`Initialization completed for project: ${context.projectId}`)

        return {
          success: true,
          projectId: context.projectId!,
          project: context.projectWithRelations,
          jobIds: context.jobIds,
        }
      })

      return result
    } catch (error) {
      this.logger.error('Initialization failed:', error)

      // 分类错误
      const classified = this.classifyError(error, context.currentState)

      // 记录详细日志
      await this.logError(context, classified)

      return {
        success: false,
        projectId: context.projectId || '',
        error: classified.message,
        errorStep: context.currentState,
      }
    }
  }

  /**
   * 执行当前状态
   */
  private async executeCurrentState(context: InitializationContext): Promise<void> {
    const handler = this.handlers.get(context.currentState)

    if (!handler) {
      throw new Error(`No handler found for state: ${context.currentState}`)
    }

    if (!handler.canHandle(context)) {
      this.logger.info(`Skipping state: ${context.currentState}`)
      await this.transitionToNext(context)
      return
    }

    this.logger.info(`Executing state: ${context.currentState}`)

    try {
      context.progress = handler.getProgress()
      await handler.execute(context)
      await this.transitionToNext(context)
    } catch (error) {
      this.logger.error(`Error in state ${context.currentState}:`, error)

      // 分类错误并抛出
      const classified = this.classifyError(error, context.currentState)
      context.error = classified

      await this.transition(context, 'ERROR')
      throw classified
    }
  }

  /**
   * 转换到下一个状态
   */
  private async transitionToNext(context: InitializationContext): Promise<void> {
    // 根据当前状态自动确定下一个事件
    const nextEvent = this.getNextEvent(context.currentState)
    if (nextEvent) {
      await this.transition(context, nextEvent)
    }
  }

  /**
   * 状态转换
   */
  private async transition(
    context: InitializationContext,
    event: InitializationEvent,
  ): Promise<void> {
    const currentState = context.currentState
    const nextState = this.transitions[currentState]?.[event]

    if (!nextState) {
      throw new Error(`Invalid transition: ${currentState} -> ${event}`)
    }

    this.logger.info(`Transition: ${currentState} --[${event}]--> ${nextState}`)
    context.currentState = nextState
  }

  /**
   * 获取下一个事件（自动推进）
   */
  private getNextEvent(state: InitializationState): InitializationEvent | null {
    const eventMap: Partial<Record<InitializationState, InitializationEvent>> = {
      CREATING_PROJECT: 'PROJECT_CREATED',
      LOADING_TEMPLATE: 'TEMPLATE_LOADED',
      RENDERING_TEMPLATE: 'TEMPLATE_RENDERED',
      CREATING_ENVIRONMENTS: 'ENVIRONMENTS_CREATED',
      SETTING_UP_REPOSITORY: 'REPOSITORY_READY',
      FINALIZING: 'FINALIZED',
    }

    return eventMap[state] || null
  }

  /**
   * 分类错误
   */
  private classifyError(error: unknown, step: InitializationState): ProjectInitializationError {
    if (error instanceof ProjectInitializationError) {
      return error
    }

    const message = error instanceof Error ? error.message : String(error)
    const cause = error instanceof Error ? error : new Error(message)

    switch (step) {
      case 'CREATING_PROJECT':
        return new ProjectCreationFailedError('', cause)
      case 'LOADING_TEMPLATE':
        return new TemplateLoadFailedError('', '', cause)
      case 'CREATING_ENVIRONMENTS':
        return new EnvironmentCreationFailedError('', cause)
      case 'SETTING_UP_REPOSITORY':
        return new RepositorySetupFailedError('', cause)
      case 'FINALIZING':
        return new FinalizationFailedError('', cause)
      default:
        return new ProjectInitializationError('', message, step)
    }
  }

  /**
   * 记录详细错误日志
   */
  private async logError(
    context: InitializationContext,
    error: ProjectInitializationError,
  ): Promise<void> {
    this.logger.error('Initialization failed:', {
      projectId: context.projectId,
      step: context.currentState,
      error: error.message,
      retryable: error.retryable,
      context: {
        userId: context.userId,
        organizationId: context.organizationId,
        projectName: context.projectData.name,
        templateId: context.templateId,
        hasRepository: !!context.repository,
      },
    })
  }
}
