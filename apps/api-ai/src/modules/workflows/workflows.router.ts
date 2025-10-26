import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { WorkflowsService, WorkflowStatus, WorkflowTriggerType, WorkflowStepType, WorkflowExecutionStatus } from './workflows.service';
import { z } from 'zod';

// Zod schemas for validation
const workflowStepSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(WorkflowStepType),
  name: z.string(),
  description: z.string().optional(),
  config: z.record(z.string(), z.any()),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  connections: z.object({
    input: z.array(z.string()),
    output: z.array(z.string()),
  }),
});

const workflowTriggerSchema = z.object({
  type: z.nativeEnum(WorkflowTriggerType),
  config: z.record(z.string(), z.any()),
  isActive: z.boolean(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  projectId: z.string(),
  organizationId: z.string(),
  createdBy: z.string(),
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema).optional(),
  variables: z.record(z.string(), z.any()).optional(),
  settings: z.object({
    timeout: z.number().min(1).optional(),
    retryCount: z.number().min(0).max(10).optional(),
    enableLogging: z.boolean().optional(),
    enableNotifications: z.boolean().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(WorkflowStatus).optional(),
  trigger: workflowTriggerSchema.optional(),
  steps: z.array(workflowStepSchema).optional(),
  variables: z.record(z.string(), z.any()).optional(),
  settings: z.object({
    timeout: z.number().min(1).optional(),
    retryCount: z.number().min(0).max(10).optional(),
    enableLogging: z.boolean().optional(),
    enableNotifications: z.boolean().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
});

@Injectable()
export class WorkflowsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly workflowsService: WorkflowsService,
  ) {}

  public get workflowsRouter() {
    return this.trpc.router({
      // 健康检查
      hello: this.trpc.publicProcedure
        .input(z.object({ name: z.string().optional() }))
        .query(({ input }) => {
          return `Hello from Workflows module ${input?.name ?? 'world'}`;
        }),

      // 创建工作流
      create: this.trpc.protectedProcedure
        .input(createWorkflowSchema)
        .mutation(async ({ input }) => {
          return await this.workflowsService.createWorkflow(input);
        }),

      // 根据ID获取工作流
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
          const workflow = await this.workflowsService.getWorkflowById(input.id);
          if (!workflow) {
            throw new Error('Workflow not found');
          }
          return workflow;
        }),

      // 更新工作流
      update: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string(),
          data: updateWorkflowSchema,
        }))
        .mutation(async ({ input }) => {
          const workflow = await this.workflowsService.updateWorkflow(input.id, input.data);
          if (!workflow) {
            throw new Error('Workflow not found');
          }
          return workflow;
        }),

      // 删除工作流
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
          const success = await this.workflowsService.deleteWorkflow(input.id);
          return { success };
        }),

      // 获取项目的工作流列表
      getProjectWorkflows: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string(),
          limit: z.number().min(1).max(100).optional().default(20),
          offset: z.number().min(0).optional().default(0),
          status: z.nativeEnum(WorkflowStatus).optional(),
          search: z.string().optional(),
          tags: z.array(z.string()).optional(),
        }))
        .query(async ({ input }) => {
          return await this.workflowsService.getProjectWorkflows(input.projectId, input);
        }),

      // 执行工作流
      execute: this.trpc.protectedProcedure
        .input(z.object({
          workflowId: z.string(),
          input: z.record(z.string(), z.any()).optional().default({}),
          triggeredBy: z.string(),
        }))
        .mutation(async ({ input }) => {
          return await this.workflowsService.executeWorkflow(
            input.workflowId,
            input.input,
            input.triggeredBy
          );
        }),

      // 获取工作流执行历史
      getExecutions: this.trpc.protectedProcedure
        .input(z.object({
          workflowId: z.string(),
          limit: z.number().min(1).max(100).optional().default(20),
          offset: z.number().min(0).optional().default(0),
          status: z.nativeEnum(WorkflowExecutionStatus).optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }))
        .query(async ({ input }) => {
          return await this.workflowsService.getWorkflowExecutions(input.workflowId, input);
        }),

      // 取消工作流执行
      cancelExecution: this.trpc.protectedProcedure
        .input(z.object({ executionId: z.string() }))
        .mutation(async ({ input }) => {
          const success = await this.workflowsService.cancelExecution(input.executionId);
          return { success };
        }),

      // 获取工作流统计信息
      getStats: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string().optional() }))
        .query(async ({ input }) => {
          return await this.workflowsService.getWorkflowStats(input.projectId);
        }),

      // 复制工作流
      duplicate: this.trpc.protectedProcedure
        .input(z.object({
          workflowId: z.string(),
          newName: z.string().min(1).max(255),
          createdBy: z.string(),
        }))
        .mutation(async ({ input }) => {
          const workflow = await this.workflowsService.duplicateWorkflow(
            input.workflowId,
            input.newName,
            input.createdBy
          );
          if (!workflow) {
            throw new Error('Failed to duplicate workflow');
          }
          return workflow;
        }),

      // 验证工作流配置
      validate: this.trpc.protectedProcedure
        .input(z.object({
          workflow: z.object({
            name: z.string().optional(),
            projectId: z.string().optional(),
            trigger: workflowTriggerSchema.optional(),
            steps: z.array(workflowStepSchema).optional(),
          }),
        }))
        .mutation(async ({ input }) => {
          return await this.workflowsService.validateWorkflow(input.workflow);
        }),

      // 获取工作流步骤类型列表
      getStepTypes: this.trpc.publicProcedure
        .query(() => {
          return Object.values(WorkflowStepType).map(type => ({
            type,
            name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: this.getStepTypeDescription(type),
          }));
        }),

      // 获取工作流触发器类型列表
      getTriggerTypes: this.trpc.publicProcedure
        .query(() => {
          return Object.values(WorkflowTriggerType).map(type => ({
            type,
            name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: this.getTriggerTypeDescription(type),
          }));
        }),
    });
  }

  private getStepTypeDescription(type: WorkflowStepType): string {
    const descriptions = {
      [WorkflowStepType.AI_CHAT]: 'Interact with AI assistants for chat completions',
      [WorkflowStepType.CODE_ANALYSIS]: 'Analyze code for quality, security, and performance',
      [WorkflowStepType.DATA_PROCESSING]: 'Process and transform data',
      [WorkflowStepType.API_REQUEST]: 'Make HTTP requests to external APIs',
      [WorkflowStepType.CONDITION]: 'Add conditional logic to workflow',
      [WorkflowStepType.LOOP]: 'Repeat steps for multiple items',
      [WorkflowStepType.DELAY]: 'Add delays between steps',
      [WorkflowStepType.NOTIFICATION]: 'Send notifications via email, Slack, etc.',
    };
    return descriptions[type] || 'No description available';
  }

  private getTriggerTypeDescription(type: WorkflowTriggerType): string {
    const descriptions = {
      [WorkflowTriggerType.MANUAL]: 'Manually trigger the workflow',
      [WorkflowTriggerType.SCHEDULE]: 'Trigger on a schedule (cron-like)',
      [WorkflowTriggerType.WEBHOOK]: 'Trigger via webhook URL',
      [WorkflowTriggerType.EVENT]: 'Trigger on system events',
      [WorkflowTriggerType.API_CALL]: 'Trigger via API call',
    };
    return descriptions[type] || 'No description available';
  }
}