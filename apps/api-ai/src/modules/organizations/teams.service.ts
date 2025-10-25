import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { DATABASE_CONNECTION } from '../../database';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schemas';
import { 
  teams, 
  Team, 
  NewTeam,
  UpdateTeam,
  insertTeamSchema,
  updateTeamSchema 
} from '../../database/schemas/teams.schema';


@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectDatabase() private readonly db: NodePgDatabase<typeof schema>
  ) {}

  /**
   * 创建新团队
   */
  async createTeam(teamData: NewTeam): Promise<Team> {
    try {
      // 验证输入数据
      insertTeamSchema.parse(teamData);
      
      // 检查同组织内slug是否已存在
      const existingTeam = await this.findBySlugInOrganization(
        teamData.organizationId, 
        teamData.slug
      );
      if (existingTeam) {
        throw new ConflictException('Team slug already exists in this organization');
      }

      const [newTeam] = await this.db
        .insert(teams)
        .values(teamData)
        .returning();

      this.logger.log(`Team created: ${newTeam.id} in organization ${newTeam.organizationId}`);
      return newTeam;
    } catch (error) {
      this.logger.error(`Failed to create team: ${error}`);
      throw error;
    }
  }

  /**
   * 根据ID查找团队
   */
  async findById(id: string): Promise<Team | null> {
    try {
      const [team] = await this.db
        .select()
        .from(teams)
        .where(eq(teams.id, id))
        .limit(1);

      return team || null;
    } catch (error) {
      this.logger.error(`Failed to find team by ID ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 根据组织ID和slug查找团队
   */
  async findBySlugInOrganization(organizationId: string, slug: string): Promise<Team | null> {
    try {
      const [team] = await this.db
        .select()
        .from(teams)
        .where(and(
          eq(teams.organizationId, organizationId),
          eq(teams.slug, slug)
        ))
        .limit(1);

      return team || null;
    } catch (error) {
      this.logger.error(`Failed to find team by slug ${slug} in organization ${organizationId}: ${error}`);
      throw error;
    }
  }

  /**
   * 获取组织下的所有团队
   */
  async getTeamsByOrganization(organizationId: string, limit = 20, offset = 0): Promise<Team[]> {
    try {
      return await this.db
        .select()
        .from(teams)
        .where(eq(teams.organizationId, organizationId))
        .orderBy(desc(teams.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      this.logger.error(`Failed to get teams for organization ${organizationId}: ${error}`);
      throw error;
    }
  }

  /**
   * 更新团队信息
   */
  async updateTeam(id: string, updateData: UpdateTeam): Promise<Team> {
    try {
      // 验证输入数据
      const validatedData = updateTeamSchema.parse(updateData);

      // 检查团队是否存在
      const existingTeam = await this.findById(id);
      if (!existingTeam) {
        throw new NotFoundException('Team not found');
      }

      // 检查slug冲突（如果要更新slug）
      if (validatedData.slug && validatedData.slug !== existingTeam.slug) {
        const slugTeam = await this.findBySlugInOrganization(
          existingTeam.organizationId, 
          validatedData.slug
        );
        if (slugTeam && slugTeam.id !== id) {
          throw new ConflictException('Team slug already exists in this organization');
        }
      }

      const [updatedTeam] = await this.db
        .update(teams)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(teams.id, id))
        .returning();

      this.logger.log(`Team updated: ${id}`);
      return updatedTeam;
    } catch (error) {
      this.logger.error(`Failed to update team ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 删除团队
   */
  async deleteTeam(id: string): Promise<void> {
    try {
      const existingTeam = await this.findById(id);
      if (!existingTeam) {
        throw new NotFoundException('Team not found');
      }

      await this.db
        .delete(teams)
        .where(eq(teams.id, id));

      this.logger.log(`Team deleted: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete team ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 搜索组织内的团队
   */
  async searchTeamsInOrganization(
    organizationId: string, 
    query: string, 
    limit = 20, 
    offset = 0
  ): Promise<Team[]> {
    try {
      const searchPattern = `%${query}%`;
      
      return await this.db
        .select()
        .from(teams)
        .where(and(
          eq(teams.organizationId, organizationId),
          or(
            ilike(teams.name, searchPattern),
            ilike(teams.slug, searchPattern),
            ilike(teams.description, searchPattern)
          )
        ))
        .orderBy(desc(teams.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      this.logger.error(`Failed to search teams in organization ${organizationId}: ${error}`);
      throw error;
    }
  }

  /**
   * 根据外部ID查找团队
   */
  async findByExternalId(externalId: string): Promise<Team | null> {
    try {
      const [team] = await this.db
        .select()
        .from(teams)
        .where(eq(teams.externalId, externalId))
        .limit(1);

      return team || null;
    } catch (error) {
      this.logger.error(`Failed to find team by external ID ${externalId}: ${error}`);
      throw error;
    }
  }

  /**
   * 获取团队数量统计
   */
  async getTeamCountByOrganization(organizationId: string): Promise<number> {
    try {
      const result = await this.db
        .select({ count: teams.id })
        .from(teams)
        .where(eq(teams.organizationId, organizationId));

      return result.length;
    } catch (error) {
      this.logger.error(`Failed to get team count for organization ${organizationId}: ${error}`);
      throw error;
    }
  }
}