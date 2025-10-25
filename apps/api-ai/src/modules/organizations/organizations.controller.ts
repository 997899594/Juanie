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
import { OrganizationsService } from './organizations.service';
import {
  insertOrganizationSchema,
  updateOrganizationSchema,
  type NewOrganization,
  type UpdateOrganization,
  type Organization,
} from '../../database/schemas/organizations.schema';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ValidationPipe({ transform: true })) createOrganizationDto: NewOrganization,
  ): Promise<Organization> {
    insertOrganizationSchema.parse(createOrganizationDto);
    return this.organizationsService.createOrganization(createOrganizationDto);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<{ organizations: Organization[]; total: number; page: number; limit: number }> {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    const offset = (pageNum - 1) * limitNum;

    if (search) {
      const organizations = await this.organizationsService.searchOrganizations(search, limitNum, offset);
      return {
        organizations,
        total: organizations.length,
        page: pageNum,
        limit: limitNum,
      };
    } else {
      const organizations = await this.organizationsService.getOrganizations(limitNum, offset);
      return {
        organizations,
        total: organizations.length,
        page: pageNum,
        limit: limitNum,
      };
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Organization | null> {
    return this.organizationsService.findById(id);
  }

  @Get('by-name/:name')
  async findByName(@Param('name') name: string): Promise<Organization | null> {
    return this.organizationsService.findByName(name);
  }

  @Get('by-slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<Organization | null> {
    return this.organizationsService.findBySlug(slug);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) updateOrganizationDto: UpdateOrganization,
  ): Promise<Organization> {
    const validatedData = updateOrganizationSchema.parse(updateOrganizationDto);
    return this.organizationsService.updateOrganization(id, validatedData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.organizationsService.deleteOrganization(id);
  }

  @Put(':id/usage')
  async updateUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() usage: {
      currentProjects?: number;
      currentUsers?: number;
      currentStorage?: number;
      currentMonthlyRuns?: number;
    },
  ): Promise<Organization> {
    return this.organizationsService.updateUsage(id, usage);
  }

  @Get(':id/usage-limits')
  async checkUsageLimits(@Param('id', ParseUUIDPipe) id: string): Promise<{
    withinLimits: boolean;
    violations: string[];
  }> {
    return this.organizationsService.checkUsageLimits(id);
  }
}