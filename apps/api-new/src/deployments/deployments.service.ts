import { Injectable, NotFoundException, BadRequestException, Inject, ForbiddenException } from '@nestjs/common';
import { PG_CONNECTION } from '../db/drizzle.provider';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { 
  deployments, 
  environments, 
  projects, 
  projectMembers, 
  users,
  SelectDeployment,
  InsertDeployment,
} from '../db/schema';
import { 
  CreateDeploymentInput,
  UpdateDeploymentInput,
  ListDeploymentsByProjectInput,
  GetDeploymentByIdInput,
  GetDeploymentStatsInput,
  RedeployInput,
  RollbackDeploymentInput,
  CancelDeploymentInput,
  GetDeploymentLogsInput,
} from '../schemas/deployment.schema';
import { eq, and, or, desc, sql, count, avg } from 'drizzle-orm';

@Injectable()
export class DeploymentsService {
  constructor(
    @Inject(PG_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof import("../db/schema")>
  ) {}

  async create(input: CreateDeploymentInput, userId: number): Promise<SelectDeployment> {
    const [environment] = await this.db
      .select()
      .from(environments)
      .where(eq(environments.id, input.environmentId))
      .limit(1);

    if (!environment) {
      throw new NotFoundException('环境不存在');
    }

    await this.checkDeploymentPermission(environment.projectId, userId);

    const [deployment] = await this.db
      .insert(deployments)
      .values({
        projectId: environment.projectId,
        environmentId: input.environmentId,
        version: input.version,
        commitHash: input.commitHash,
        commitMessage: input.commitMessage,
        branch: input.branch,
        status: 'pending',
        userId: userId,
        metadata: input.metadata,
      })
      .returning();

    return deployment;
  }

  async listByProject(input: ListDeploymentsByProjectInput, userId: number): Promise<SelectDeployment[]> {
    await this.checkProjectPermission(input.projectId, userId);

    // 构建查询条件
    const conditions = [eq(deployments.projectId, input.projectId)];
    if (input.environmentId) conditions.push(eq(deployments.environmentId, input.environmentId));
    if (input.status) conditions.push(eq(deployments.status, input.status));

    return this.db.select().from(deployments).where(and(...conditions)).orderBy(desc(deployments.createdAt)).limit(input.limit).offset((input.page - 1) * input.limit);
  }

  async getById(input: GetDeploymentByIdInput, userId: number): Promise<SelectDeployment> {
    const [deployment] = await this.db.select().from(deployments).where(eq(deployments.id, input.id)).limit(1);
    if (!deployment) throw new NotFoundException('部署记录不存在');
    
    await this.checkProjectPermission(deployment.projectId, userId);
    return deployment;
  }

  async getStats(input: GetDeploymentStatsInput, userId: number) {
    await this.checkProjectPermission(input.projectId, userId, ['owner', 'admin', 'member', 'viewer']);

    const stats = await this.db
      .select({
        total: count(),
        successful: sql<number>`COUNT(CASE WHEN ${deployments.status} = 'success' THEN 1 END)`,
        failed: sql<number>`COUNT(CASE WHEN ${deployments.status} = 'failed' THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${deployments.status} = 'pending' THEN 1 END)`,
        running: sql<number>`COUNT(CASE WHEN ${deployments.status} = 'running' THEN 1 END)`,
      })
      .from(deployments)
      .where(eq(deployments.projectId, input.projectId));

    // 获取最近的部署记录 - 使用 innerJoin 确保关联数据完整
    const recentDeployments = await this.db
      .select({
        id: deployments.id,
        projectId: deployments.projectId,
        environmentId: deployments.environmentId,
        userId: deployments.userId,
        version: deployments.version,
        commitHash: deployments.commitHash,
        commitMessage: deployments.commitMessage,
        branch: deployments.branch,
        status: deployments.status,
        logs: deployments.logs,
        startedAt: deployments.startedAt,
        finishedAt: deployments.finishedAt,
        metadata: deployments.metadata,
        createdAt: deployments.createdAt,
        updatedAt: deployments.updatedAt,
        project: {
          id: projects.id,
          name: projects.name,
          displayName: projects.displayName,
        },
        environment: {
          id: environments.id,
          name: environments.name,
          displayName: environments.displayName,
        },
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .innerJoin(environments, eq(deployments.environmentId, environments.id))
      .innerJoin(users, eq(deployments.userId, users.id))
      .where(eq(deployments.projectId, input.projectId))
      .orderBy(desc(deployments.createdAt))
      .limit(10);

    // 模拟按天统计数据
    const deploymentsByDay: Array<{
      date: string;
      count: number;
      successCount: number;
      failedCount: number;
    }> = [];
    for (let i = input.days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      deploymentsByDay.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 5),
        successCount: Math.floor(Math.random() * 3),
        failedCount: Math.floor(Math.random() * 2),
      });
    }

    return {
      totalDeployments: stats[0]?.total || 0,
      successfulDeployments: stats[0]?.successful || 0,
      failedDeployments: stats[0]?.failed || 0,
      pendingDeployments: stats[0]?.pending || 0,
      runningDeployments: stats[0]?.running || 0,
      averageDeployTime: 4.5, // 模拟平均部署时间（分钟）
      deploymentsByDay,
      recentDeployments,
    };
  }

  async redeploy(input: RedeployInput, userId: number): Promise<SelectDeployment> {
    const [originalDeployment] = await this.db
      .select()
      .from(deployments)
      .where(eq(deployments.id, input.deploymentId))
      .limit(1);

    if (!originalDeployment) {
      throw new NotFoundException('原部署不存在');
    }

    await this.checkDeploymentPermission(originalDeployment.projectId, userId);

    const [newDeployment] = await this.db
      .insert(deployments)
      .values({
        projectId: originalDeployment.projectId,
        environmentId: originalDeployment.environmentId,
        version: originalDeployment.version,
        commitHash: originalDeployment.commitHash,
        commitMessage: `重新部署自: ${originalDeployment.id}`,
        branch: originalDeployment.branch,
        status: 'pending',
        userId: userId,
        metadata: {
          previousDeploymentId: originalDeployment.id,
        },
      })
      .returning();

    return newDeployment;
  }

  async rollback(input: RollbackDeploymentInput, userId: number): Promise<SelectDeployment> {
    const [targetDeployment] = await this.db
      .select()
      .from(deployments)
      .where(eq(deployments.id, input.deploymentId))
      .limit(1);

    if (!targetDeployment) {
      throw new NotFoundException('目标部署不存在');
    }

    if (targetDeployment.status !== 'success') {
      throw new BadRequestException('只能回滚到成功的部署');
    }

    await this.checkDeploymentPermission(targetDeployment.projectId, userId);

    const [rollbackDeployment] = await this.db
      .insert(deployments)
      .values({
        projectId: targetDeployment.projectId,
        environmentId: targetDeployment.environmentId,
        version: targetDeployment.version,
        commitHash: targetDeployment.commitHash,
        commitMessage: `回滚到部署: ${targetDeployment.id}`,
        branch: targetDeployment.branch,
        status: 'pending',
        userId: userId,
        metadata: {
          rollbackFromId: targetDeployment.id,
        },
      })
      .returning();

    return rollbackDeployment;
  }

  async cancel(input: CancelDeploymentInput, userId: number): Promise<SelectDeployment> {
    const [deployment] = await this.db
      .select()
      .from(deployments)
      .where(eq(deployments.id, input.id))
      .limit(1);

    if (!deployment) {
      throw new NotFoundException('部署不存在');
    }

    await this.checkDeploymentPermission(deployment.projectId, userId);

    if (deployment.status !== 'pending') {
      throw new BadRequestException('只能取消待处理的部署');
    }

    const [cancelledDeployment] = await this.db
      .update(deployments)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, input.id))
      .returning();

    return cancelledDeployment;
  }

  async getLogs(input: GetDeploymentLogsInput, userId: number) {
    const [deployment] = await this.db.select().from(deployments).where(eq(deployments.id, input.id)).limit(1);
    if (!deployment) throw new NotFoundException('部署记录不存在');
    
    await this.checkProjectPermission(deployment.projectId, userId);

    // 模拟日志数据
    const mockLogs = Array.from({ length: 500 }, (_, i) => 
      `[${new Date().toISOString()}] ${['INFO', 'WARN', 'ERROR'][i % 3]}: 部署日志 ${i + 1}`
    );
    
    const startIndex = input.offset || 0;
    const endIndex = Math.min(startIndex + (input.limit || 100), mockLogs.length);
    
    return {
      logs: mockLogs.slice(startIndex, endIndex).join('\n'),
      hasMore: endIndex < mockLogs.length,
      totalLines: mockLogs.length,
    };
  }

  private async checkProjectPermission(
    projectId: number, 
    userId: number, 
    requiredRoles?: string[]
  ): Promise<void> {
    const [member] = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        )
      )
      .limit(1);

    if (!member) {
      throw new ForbiddenException('您没有访问该项目的权限');
    }

    if (requiredRoles && !requiredRoles.includes(member.role)) {
      throw new ForbiddenException('您没有执行此操作的权限');
    }
  }

  private async checkDeploymentPermission(projectId: number, userId: number): Promise<void> {
    await this.checkProjectPermission(projectId, userId, ['owner', 'admin', 'member']);
  }
}
