import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray, gte, lte, or } from 'drizzle-orm';
import { 
  teams, 
  Team, 
  NewTeam,
  UpdateTeam,
  insertTeamSchema,
  updateTeamSchema 
} from '../../database/schemas/teams.schema';
import { 
  teamMembers,
  TeamMembershipRoleEnum,
  TeamMembershipStatusEnum 
} from '../../database/schemas/team-members.schema';
import { users } from '../../database/schemas/users.schema';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create team: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据ID获取团队
   */
  async getTeamById(id: string): Promise<Team> {
    try {
      const [team] = await this.db
        .select()
        .from(teams)
        .where(eq(teams.id, id));

      if (!team) {
        throw new NotFoundException(`Team with ID ${id} not found`);
      }

      return team;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team by ID ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据组织ID获取团队列表
   */
  async getTeamsByOrganization(
    organizationId: string, 
    limit = 20, 
    offset = 0
  ): Promise<Team[]> {
    try {
      return await this.db
        .select()
        .from(teams)
        .where(eq(teams.organizationId, organizationId))
        .orderBy(desc(teams.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get teams by organization ${organizationId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新团队信息
   */
  async updateTeam(id: string, updateData: UpdateTeam): Promise<Team> {
    try {
      // 验证输入数据
      updateTeamSchema.parse(updateData);

      // 检查团队是否存在
      await this.getTeamById(id);

      // 如果更新slug，检查是否冲突
      if (updateData.slug) {
        const team = await this.getTeamById(id);
        const existingTeam = await this.findBySlugInOrganization(
          team.organizationId, 
          updateData.slug
        );
        if (existingTeam && existingTeam.id !== id) {
          throw new ConflictException('Team slug already exists in this organization');
        }
      }

      const [updatedTeam] = await this.db
        .update(teams)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, id))
        .returning();

      this.logger.log(`Team updated: ${id}`);
      return updatedTeam;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update team ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 删除团队
   */
  async deleteTeam(id: string): Promise<void> {
    try {
      // 检查团队是否存在
      await this.getTeamById(id);

      await this.db
        .delete(teams)
        .where(eq(teams.id, id));

      this.logger.log(`Team deleted: ${id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete team ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 批量删除团队
   */
  async deleteTeams(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) {
        throw new BadRequestException('No team IDs provided');
      }

      await this.db
        .delete(teams)
        .where(inArray(teams.id, ids));

      this.logger.log(`Teams deleted: ${ids.join(', ')}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete teams: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据组织和slug查找团队
   */
  async findBySlugInOrganization(organizationId: string, slug: string): Promise<Team | null> {
    try {
      const [team] = await this.db
        .select()
        .from(teams)
        .where(and(
          eq(teams.organizationId, organizationId),
          eq(teams.slug, slug)
        ));

      return team || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find team by slug ${slug} in organization ${organizationId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取组织内团队数量
   */
  async getTeamCountByOrganization(organizationId: string): Promise<number> {
    try {
      const [result] = await this.db
        .select({ count: count() })
        .from(teams)
        .where(eq(teams.organizationId, organizationId));

      return result.count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team count for organization ${organizationId}: ${errorMessage}`);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search teams in organization ${organizationId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取团队统计信息
   */
  async getTeamStats(teamId: string): Promise<{
    totalMembers: number;
    activeMembers: number;
    pendingMembers: number;
    membersByRole: Record<string, number>;
  }> {
    try {
      // 获取总成员数
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      // 获取活跃成员数
      const [activeResult] = await this.db
        .select({ count: count() })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.status, 'active')
        ));

      // 获取待审核成员数
      const [pendingResult] = await this.db
        .select({ count: count() })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.status, 'pending')
        ));

      // 获取按角色分组的成员数
      const roleStats = await this.db
        .select({
          role: teamMembers.role,
          count: count()
        })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.status, 'active')
        ))
        .groupBy(teamMembers.role);

      const membersByRole: Record<string, number> = {};
      roleStats.forEach(stat => {
        membersByRole[stat.role] = stat.count;
      });

      return {
        totalMembers: totalResult.count,
        activeMembers: activeResult.count,
        pendingMembers: pendingResult.count,
        membersByRole,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team stats for ${teamId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取团队成员列表（包含用户信息）
   */
  async getTeamMembersWithUsers(teamId: string, limit = 20, offset = 0) {
    try {
      const members = await this.db
        .select({
          id: teamMembers.id,
          teamId: teamMembers.teamId,
          userId: teamMembers.userId,
          role: teamMembers.role,
          status: teamMembers.status,
          invitedBy: teamMembers.invitedBy,
          joinedAt: teamMembers.joinedAt,
          createdAt: teamMembers.createdAt,
          updatedAt: teamMembers.updatedAt,
          user: {
            id: users.id,
            email: users.email,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          }
        })
        .from(teamMembers)
        .leftJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(desc(teamMembers.joinedAt))
        .limit(limit)
        .offset(offset);

      return members;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get team members with users for ${teamId}: ${errorMessage}`);
      throw error;
    }
  }
}