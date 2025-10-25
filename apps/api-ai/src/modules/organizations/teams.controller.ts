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
import { TeamsService } from './teams.service';
import {
  insertTeamSchema,
  updateTeamSchema,
  type CreateTeam,
  type UpdateTeam,
  type Team,
} from '../../database/schemas/teams.schema';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ValidationPipe({ transform: true })) createTeamDto: CreateTeam,
  ): Promise<Team> {
    insertTeamSchema.parse(createTeamDto);
    return this.teamsService.createTeam(createTeamDto);
  }

  @Get('organization/:organizationId')
  async findByOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<{ teams: Team[]; total: number; page: number; limit: number }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    if (search) {
      const teams = await this.teamsService.searchTeamsInOrganization(organizationId, search, limitNum, (pageNum - 1) * limitNum);
      return {
        teams,
        total: teams.length,
        page: pageNum,
        limit: limitNum,
      };
    }

    const teams = await this.teamsService.getTeamsByOrganization(organizationId, limitNum, (pageNum - 1) * limitNum);
    const total = await this.teamsService.getTeamCountByOrganization(organizationId);
    
    return {
      teams,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Team | null> {
    return this.teamsService.findById(id);
  }

  @Get('by-slug/:organizationId/:slug')
  async findBySlug(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('slug') slug: string,
  ): Promise<Team | null> {
    return this.teamsService.findBySlugInOrganization(organizationId, slug);
  }

  @Get('by-external-id/:externalId')
  async findByExternalId(@Param('externalId') externalId: string): Promise<Team | null> {
    return this.teamsService.findByExternalId(externalId);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) updateTeamDto: UpdateTeam,
  ): Promise<Team> {
    const validatedData = updateTeamSchema.parse(updateTeamDto);
    return this.teamsService.updateTeam(id, validatedData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.teamsService.deleteTeam(id);
  }

  @Get('organization/:organizationId/stats')
  async getStats(@Param('organizationId', ParseUUIDPipe) organizationId: string): Promise<{
    totalTeams: number;
  }> {
    const totalTeams = await this.teamsService.getTeamCountByOrganization(organizationId);
    return { totalTeams };
  }
}