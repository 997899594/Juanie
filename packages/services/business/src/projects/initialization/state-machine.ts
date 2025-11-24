import { Injectable, Logger } from '@nestjs/common'
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
 */
@Injectable()
export class ProjectInitializationStateMachine {
  private readonly logger = new Logger(ProjectInitializationStateMachine.name)
  private handlers = new Map<InitializationState, StateHandler>()

  constructor() {}

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
      REPOSITORY_READY: 'CREATING_GITOPS',
      ERROR: 'FAILED',
    },
    CREATING_GITOPS: {
      GITOPS_CREATED: 'FINALIZING',
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
   * 执行初始化流程
   */
  async execute(context: InitializationContext): Promise<InitializationResult> {
    this.logger.log(`Starting initialization for project: ${context.projectData.name}`)

    try {
      // 触发开始事件
      await this.transition(context, 'START')

      // 执行状态机循环
      while (context.currentState !== 'COMPLETED' && context.currentState !== 'FAILED') {
        await this.executeCurrentState(context)
      }

      if (context.currentState === 'COMPLETED') {
        this.logger.log(`Initialization completed for project: ${context.projectId}`)

        return {
          success: true,
          projectId: context.projectId!,
          jobIds: context.jobIds,
        }
      }

      // 失败状态
      this.logger.error(`Initialization failed: ${context.error?.message}`)
      return {
        success: false,
        projectId: context.projectId!,
        error: context.error?.message || 'Unknown error',
      }
    } catch (error) {
      this.logger.error('Initialization error:', error)
      context.error = error as Error
      context.currentState = 'FAILED'

      return {
        success: false,
        projectId: context.projectId || '',
        error: (error as Error).message,
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
      // 跳过此状态
      this.logger.log(`Skipping state: ${context.currentState}`)
      await this.transitionToNext(context)
      return
    }

    this.logger.log(`Executing state: ${context.currentState}`)

    try {
      // 更新进度
      context.progress = handler.getProgress()

      // 执行状态处理
      await handler.execute(context)

      // 转换到下一个状态
      await this.transitionToNext(context)
    } catch (error) {
      this.logger.error(`Error in state ${context.currentState}:`, error)
      context.error = error as Error

      await this.transition(context, 'ERROR')
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

    this.logger.log(`Transition: ${currentState} --[${event}]--> ${nextState}`)
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
      CREATING_GITOPS: 'GITOPS_CREATED',
      FINALIZING: 'FINALIZED',
    }

    return eventMap[state] || null
  }
}
