import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { TeamMembersService } from './team-members.service';
import {
  insertTeamMemberSchema,
  updateTeamMemberSchema,
  selectTeamMemberSchema,
  type UpdateTeamMember,
  type NewTeamMember,
  type TeamMember,
  type TeamMembershipRole,
  type TeamMembershipStatus,
} from '../../database/schemas/team-members.schema';

@Controller('team-members')
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ValidationPipe({ transform: true })) createTeamMemberDto: NewTeamMember,
  ): Promise<TeamMember> {
    const validatedData = insertTeamMemberSchema.parse(createTeamMemberDto);
    return this.teamMembersService.addTeamMember(validatedData as any);
  }

  @Get('team/:teamId')
  async findByTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: TeamMembershipStatus,
    @Query('role') role?: TeamMembershipRole,
  ): Promise<TeamMember[]> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.teamMembersService.getTeamMembers(teamId);
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: TeamMembershipStatus,
  ): Promise<TeamMember[]> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.teamMembersService.getUserTeams(userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TeamMember | null> {
    return this.teamMembersService.findById(id);
  }

  @Get('team/:teamId/user/:userId')
  async findByTeamAndUser(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<TeamMember | null> {
    return this.teamMembersService.findByTeamAndUser(teamId, userId);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) updateTeamMemberDto: UpdateTeamMember,
  ): Promise<TeamMember> {
    const validatedData = updateTeamMemberSchema.parse(updateTeamMemberDto);
    return this.teamMembersService.updateTeamMember(id, validatedData);
  }

  @Put('team/:teamId/user/:userId')
  async updateByTeamAndUser(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ValidationPipe({ transform: true })) updateTeamMemberDto: UpdateTeamMember,
  ): Promise<TeamMember> {
    const validatedData = updateTeamMemberSchema.parse(updateTeamMemberDto);
    // Use existing updateTeamMember method with findByTeamAndUser first
    const existingMember = await this.teamMembersService.findByTeamAndUser(teamId, userId);
    if (!existingMember) {
      throw new Error('Team member not found');
    }
    return this.teamMembersService.updateTeamMember(existingMember.id, validatedData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.teamMembersService.removeTeamMember(id);
  }

  @Delete('team/:teamId/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeByTeamAndUser(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.teamMembersService.removeTeamMemberByTeamAndUser(teamId, userId);
  }

  @Get('team/:teamId/stats')
  async getTeamStats(@Param('teamId', ParseUUIDPipe) teamId: string): Promise<any> {
    return this.teamMembersService.getTeamMembers(teamId);
  }

  @Get('team/:teamId/owners')
  async getTeamOwners(@Param('teamId', ParseUUIDPipe) teamId: string): Promise<TeamMember[]> {
    return this.teamMembersService.getTeamOwners(teamId);
  }

  @Get('team/:teamId/user/:userId/check-membership')
  async checkMembership(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ isMember: boolean; isAdmin: boolean; role?: TeamMembershipRole; status?: TeamMembershipStatus }> {
    const isMember = await this.teamMembersService.isTeamMember(teamId, userId);
    const isAdmin = await this.teamMembersService.isTeamAdmin(teamId, userId);
    
    if (isMember) {
      const member = await this.teamMembersService.findByTeamAndUser(teamId, userId);
      return {
        isMember,
        isAdmin,
        role: member?.role,
        status: member?.status,
      };
    }

    return { isMember, isAdmin };
  }
}