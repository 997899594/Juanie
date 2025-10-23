import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { PG_CONNECTION } from '../db/drizzle.provider';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { 
  environments, 
  projects,
  projectMembers,
  SelectEnvironment,
  InsertEnvironment,
} from '../db/schema';
import { 
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
  ListEnvironmentsByProjectInput,
  GetEnvironmentByIdInput,
  DeleteEnvironmentInput,
} from '../schemas/environment.schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';

@Injectable()
export class EnvironmentsService {
  constructor(
    @Inject(PG_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof import("../db/schema")>
  ) {}

  // 创建环境
  async create(input: CreateEnvironmentInput, userId: number): Promise<SelectEnvironment> {
    // 检查用户是否有权限在该项目中创建环境
    await this.checkProjectPermission(input.projectId, userId, ['owner', 'admin']);

    // 检查环境名称在项目中是否已存在
    const existingEnvironment = await this.db
      .select()
      .from(environments)
      .where(
        and(
          eq(environments.projectId, input.projectId),
          eq(environments.name, input.name)
        )
      )
      .limit(1);

    if (existingEnvironment.length > 0) {
      throw new BadRequestException('环境名称在该项目中已存在');
    }

    // 创建环境
    const [environment] = await this.db
      .insert(environments)
      .values(input)
      .returning();

    return environment;
  }

  // 根据项目ID获取环境列表
  async listByProject(input: ListEnvironmentsByProjectInput, userId: number): Promise<SelectEnvironment[]> {
    // 检查用户是否有权限访问该项目
    await this.checkProjectAccess(input.projectId, userId);

    const environmentList = await this.db
      .select()
      .from(environments)
      .where(
        and(
          eq(environments.projectId, input.projectId),
          eq(environments.isActive, true)
        )
      )
      .orderBy(desc(environments.createdAt));

    return environmentList;
  }

  // 根据ID获取环境详情
  async getById(input: GetEnvironmentByIdInput, userId: number): Promise<SelectEnvironment> {
    const [environment] = await this.db
      .select()
      .from(environments)
      .where(eq(environments.id, input.id))
      .limit(1);

    if (!environment) {
      throw new NotFoundException('环境不存在');
    }

    // 检查用户是否有权限访问该环境所属的项目
    await this.checkProjectAccess(environment.projectId, userId);

    return environment;
  }

  // 更新环境
  async update(input: UpdateEnvironmentInput, userId: number): Promise<SelectEnvironment> {
    // 先获取环境信息
    const [existingEnvironment] = await this.db
      .select()
      .from(environments)
      .where(eq(environments.id, input.id))
      .limit(1);

    if (!existingEnvironment) {
      throw new NotFoundException('环境不存在');
    }

    // 检查用户是否有权限修改该环境
    await this.checkProjectPermission(existingEnvironment.projectId, userId, ['owner', 'admin']);

    // 更新环境
    const [updatedEnvironment] = await this.db
      .update(environments)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(environments.id, input.id))
      .returning();

    return updatedEnvironment;
  }

  // 删除环境
  async delete(input: DeleteEnvironmentInput, userId: number): Promise<void> {
    // 先获取环境信息
    const [existingEnvironment] = await this.db
      .select()
      .from(environments)
      .where(eq(environments.id, input.id))
      .limit(1);

    if (!existingEnvironment) {
      throw new NotFoundException('环境不存在');
    }

    // 检查用户是否有权限删除该环境
    await this.checkProjectPermission(existingEnvironment.projectId, userId, ['owner', 'admin']);

    // 软删除：设置为非活跃状态
    await this.db
      .update(environments)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(environments.id, input.id));
  }

  // 检查项目访问权限
  private async checkProjectAccess(projectId: number, userId: number): Promise<void> {
    // 检查是否是项目所有者
    const project = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      throw new NotFoundException('项目不存在');
    }

    if (project[0].ownerId === userId) {
      return;
    }

    // 检查项目成员权限
    const member = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      throw new ForbiddenException('没有权限访问该项目');
    }
  }

  // 检查项目操作权限
  private async checkProjectPermission(
    projectId: number, 
    userId: number, 
    requiredRoles: string[]
  ): Promise<void> {
    // 检查是否是项目所有者
    const project = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      throw new NotFoundException('项目不存在');
    }

    if (project[0].ownerId === userId && requiredRoles.includes('owner')) {
      return;
    }

    // 检查项目成员权限
    const member = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId)
        )
      )
      .limit(1);

    if (member.length === 0 || !requiredRoles.includes(member[0].role)) {
      throw new ForbiddenException('没有权限执行该操作');
    }
  }
}