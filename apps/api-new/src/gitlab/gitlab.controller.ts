import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateProjectInput,
  ListProjectsInput,
  SearchProjectsInput,
  GetProjectInput,
  DeleteProjectInput,
  ForkProjectInput,
  GetUserInput,
  ListGroupsInput,
} from '../schemas/gitlab.schema';
import { GitLabService } from './gitlab.service';

@Controller('gitlab')
export class GitLabController {
  constructor(private readonly gitlabService: GitLabService) {}

  @Get('user')
  async getCurrentUser(@Query('userId') userId: string) {
    return this.gitlabService.getCurrentUser(parseInt(userId));
  }

  @Get('user/:username')
  async getUser(
    @Query('userId') userId: string,
    @Param('username') username: string
  ) {
    return this.gitlabService.getUser(parseInt(userId), { username });
  }

  @Get('groups')
  async listGroups(
    @Query('userId') userId: string,
    @Query() query: ListGroupsInput
  ) {
    return this.gitlabService.listGroups(parseInt(userId), query);
  }

  @Get('projects')
  async listProjects(
    @Query('userId') userId: string,
    @Query() query: ListProjectsInput
  ) {
    return this.gitlabService.listProjects(parseInt(userId), query);
  }

  @Get('projects/:projectId')
  async getProject(
    @Query('userId') userId: string,
    @Param('projectId') projectId: string
  ) {
    return this.gitlabService.getProject(parseInt(userId), { projectId });
  }

  @Post('projects')
  async createProject(
    @Query('userId') userId: string,
    @Body() createProjectDto: CreateProjectInput
  ) {
    return this.gitlabService.createProject(parseInt(userId), createProjectDto);
  }

  @Delete('projects/:projectId')
  async deleteProject(
    @Query('userId') userId: string,
    @Param('projectId') projectId: string
  ) {
    return this.gitlabService.deleteProject(parseInt(userId), { projectId });
  }

  @Post('projects/:projectId/fork')
  async forkProject(
    @Query('userId') userId: string,
    @Param('projectId') projectId: string
  ) {
    return this.gitlabService.forkProject(parseInt(userId), { projectId });
  }

  @Get('projects/search')
  async searchProjects(
    @Query('userId') userId: string,
    @Query('search') search: string
  ) {
    return this.gitlabService.searchProjects(parseInt(userId), { search });
  }
}