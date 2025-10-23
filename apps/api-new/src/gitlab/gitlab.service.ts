import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createGitlabProjectSchema,
  listGitlabProjectsSchema,
  searchGitlabProjectsSchema,
  getGitlabProjectSchema,
  deleteGitlabProjectSchema,
  forkGitlabProjectSchema,
  getCurrentUserSchema,
  getUserSchema,
  getUserByUsernameSchema,
  listGroupsSchema,
  getGroupSchema,
  type CreateGitlabProjectInput,
  type ListGitlabProjectsInput,
  type SearchGitlabProjectsInput,
  type GetGitlabProjectInput,
  type DeleteGitlabProjectInput,
  type ForkGitlabProjectInput,
  type GetCurrentUserInput,
  type GetUserInput,
  type GetUserByUsernameInput,
  type ListGroupsInput,
  type GetGroupInput,
  type GitlabProjectResponse,
  type GitlabUserResponse,
  type GitlabGroupResponse,
} from '../schemas/gitlab.schema';
import { successResponseSchema, paginatedResponseSchema, type SuccessResponse, type SuccessMessageResponse, type PaginatedResponse } from '../schemas/common.schema';

@Injectable()
export class GitLabService {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com';
    this.accessToken = this.configService.get<string>('GITLAB_ACCESS_TOKEN') || '';
    
    // 只在需要时检查token，而不是在服务初始化时
    // if (!this.accessToken) {
    //   throw new InternalServerErrorException('GitLab access token is not configured');
    // }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/v4${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // 如果不是 JSON，使用原始错误文本
          if (errorText) {
            errorMessage = errorText;
          }
        }

        switch (response.status) {
          case 400:
            throw new BadRequestException(errorMessage);
          case 404:
            throw new NotFoundException(errorMessage);
          case 401:
          case 403:
            throw new BadRequestException('GitLab access denied. Please check your credentials.');
          default:
            throw new InternalServerErrorException(errorMessage);
        }
      }

      return response.json();
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      
      // 网络错误或其他未知错误
      throw new InternalServerErrorException(`Failed to connect to GitLab: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId: number, input?: GetCurrentUserInput): Promise<GitlabUserResponse> {
    try {
      if (input) {
        getCurrentUserSchema.parse(input);
      }
      
      const user = await this.makeRequest('/user');
      return user;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to get current user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 根据用户名获取用户信息
   */
  async getUser(userId: number, input: GetUserByUsernameInput): Promise<GitlabUserResponse[]> {
    try {
      const validatedInput = getUserByUsernameSchema.parse(input);
      const users = await this.makeRequest(`/users?username=${validatedInput.username}`);
      
      if (!Array.isArray(users) || users.length === 0) {
        throw new NotFoundException(`User with username '${validatedInput.username}' not found`);
      }
      
      return users;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取群组列表
   */
  async listGroups(userId: number, input: ListGroupsInput): Promise<PaginatedResponse<GitlabGroupResponse>> {
    try {
      const validatedInput = listGroupsSchema.parse(input);
      const params = new URLSearchParams();
      
      // 分页参数
      if (validatedInput.page !== undefined) {
        params.append('page', validatedInput.page.toString());
      }
      if (validatedInput.limit !== undefined) {
        params.append('per_page', validatedInput.limit.toString());
      }
      
      // 过滤参数
      if (validatedInput.all_available !== undefined) {
        params.append('all_available', validatedInput.all_available.toString());
      }
      if (validatedInput.owned !== undefined) {
        params.append('owned', validatedInput.owned.toString());
      }
      // 移除order_by检查，因为listGroupsSchema中没有这个字段
      if (validatedInput.sortBy) {
        params.append('sort', validatedInput.sortBy);
      }
      if (validatedInput.search) {
        params.append('search', validatedInput.search);
      }

      const groups = await this.makeRequest(`/groups?${params.toString()}`);
      
      return {
        success: true,
        data: groups,
        timestamp: new Date().toISOString(),
        pagination: {
          page: validatedInput.page || 1,
          limit: validatedInput.limit || 20,
          total: groups.length,
          totalPages: Math.ceil(groups.length / (validatedInput.limit || 20)),
          hasNext: (validatedInput.page || 1) < Math.ceil(groups.length / (validatedInput.limit || 20)),
          hasPrev: (validatedInput.page || 1) > 1,
        }
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to list groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取群组详情
   */
  async getGroup(userId: number, input: GetGroupInput): Promise<GitlabGroupResponse> {
    try {
      const validatedInput = getGroupSchema.parse(input);
      const group = await this.makeRequest(`/groups/${validatedInput.id}`);
      return group;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to get group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取项目列表
   */
  async listProjects(userId: number, input: ListGitlabProjectsInput): Promise<PaginatedResponse<GitlabProjectResponse>> {
    try {
      const validatedInput = listGitlabProjectsSchema.parse(input);
      const params = new URLSearchParams();
      
      // 分页参数
      if (validatedInput.page !== undefined) {
        params.append('page', validatedInput.page.toString());
      }
      if (validatedInput.limit !== undefined) {
        params.append('per_page', validatedInput.limit.toString());
      }
      
      // 过滤参数
      if (validatedInput.archived !== undefined) {
        params.append('archived', validatedInput.archived.toString());
      }
      if (validatedInput.visibility) {
        params.append('visibility', validatedInput.visibility);
      }
      if (validatedInput.owned !== undefined) {
        params.append('owned', validatedInput.owned.toString());
      }
      if (validatedInput.membership !== undefined) {
        params.append('membership', validatedInput.membership.toString());
      }
      if (validatedInput.starred !== undefined) {
        params.append('starred', validatedInput.starred.toString());
      }
      if (validatedInput.simple !== undefined) {
        params.append('simple', validatedInput.simple.toString());
      }
      if (validatedInput.statistics !== undefined) {
        params.append('statistics', validatedInput.statistics.toString());
      }
      if (validatedInput.with_custom_attributes !== undefined) {
        params.append('with_custom_attributes', validatedInput.with_custom_attributes.toString());
      }
      if (validatedInput.with_issues_enabled !== undefined) {
        params.append('with_issues_enabled', validatedInput.with_issues_enabled.toString());
      }
      if (validatedInput.with_merge_requests_enabled !== undefined) {
        params.append('with_merge_requests_enabled', validatedInput.with_merge_requests_enabled.toString());
      }
      if (validatedInput.min_access_level !== undefined) {
        params.append('min_access_level', validatedInput.min_access_level.toString());
      }
      if (validatedInput.order_by) {
        params.append('order_by', validatedInput.order_by);
      }
      if (validatedInput.sortBy) {
        params.append('sort', validatedInput.sortBy);
      }
      if (validatedInput.search) {
        params.append('search', validatedInput.search);
      }

      const projects = await this.makeRequest(`/projects?${params.toString()}`);
      
      return {
        success: true,
        data: projects,
        timestamp: new Date().toISOString(),
        pagination: {
          page: validatedInput.page || 1,
          limit: validatedInput.limit || 20,
          total: projects.length,
          totalPages: Math.ceil(projects.length / (validatedInput.limit || 20)),
          hasNext: (validatedInput.page || 1) < Math.ceil(projects.length / (validatedInput.limit || 20)),
          hasPrev: (validatedInput.page || 1) > 1,
        }
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取项目详情
   */
  async getProject(userId: number, input: GetGitlabProjectInput): Promise<GitlabProjectResponse> {
    try {
      const validatedInput = getGitlabProjectSchema.parse(input);
      const params = new URLSearchParams();
      
      if (validatedInput.statistics !== undefined) {
        params.append('statistics', validatedInput.statistics.toString());
      }
      if (validatedInput.license !== undefined) {
        params.append('license', validatedInput.license.toString());
      }
      if (validatedInput.with_custom_attributes !== undefined) {
        params.append('with_custom_attributes', validatedInput.with_custom_attributes.toString());
      }
      
      const queryString = params.toString();
      const endpoint = queryString ? `/projects/${validatedInput.id}?${queryString}` : `/projects/${validatedInput.id}`;
      
      const project = await this.makeRequest(endpoint);
      return project;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to get project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 创建项目
   */
  async createProject(userId: number, input: CreateGitlabProjectInput): Promise<GitlabProjectResponse> {
    try {
      const validatedInput = createGitlabProjectSchema.parse(input);
      const project = await this.makeRequest('/projects', {
        method: 'POST',
        body: JSON.stringify(validatedInput),
      });
      return project;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(userId: number, input: DeleteGitlabProjectInput): Promise<SuccessMessageResponse> {
    try {
      const validatedInput = deleteGitlabProjectSchema.parse(input);
      await this.makeRequest(`/projects/${validatedInput.id}`, {
        method: 'DELETE',
      });
      
      return {
        success: true,
        message: 'Project deleted successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fork 项目
   */
  async forkProject(userId: number, input: ForkGitlabProjectInput): Promise<GitlabProjectResponse> {
    try {
      const validatedInput = forkGitlabProjectSchema.parse(input);
      const forkData: any = {};
      
      if (validatedInput.name) {
        forkData.name = validatedInput.name;
      }
      if (validatedInput.path) {
        forkData.path = validatedInput.path;
      }
      if (validatedInput.namespace_id) {
        forkData.namespace_id = validatedInput.namespace_id;
      }
      if (validatedInput.namespace_path) {
        forkData.namespace_path = validatedInput.namespace_path;
      }
      
      const project = await this.makeRequest(`/projects/${validatedInput.id}/fork`, {
        method: 'POST',
        body: JSON.stringify(forkData),
      });
      return project;
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to fork project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 搜索项目
   */
  async searchProjects(userId: number, input: SearchGitlabProjectsInput): Promise<PaginatedResponse<GitlabProjectResponse>> {
    try {
      const validatedInput = searchGitlabProjectsSchema.parse(input);
      const params = new URLSearchParams();
      
      // 分页参数
      if (validatedInput.page !== undefined) {
        params.append('page', validatedInput.page.toString());
      }
      if (validatedInput.limit !== undefined) {
        params.append('per_page', validatedInput.limit.toString());
      }
      
      // 搜索参数
      params.append('search', validatedInput.query);
      if (validatedInput.order_by) {
        params.append('order_by', validatedInput.order_by);
      }
      if (validatedInput.sort) {
        params.append('sort', validatedInput.sort);
      }

      const projects = await this.makeRequest(`/projects?${params.toString()}`);
      
      return {
        success: true,
        data: projects,
        timestamp: new Date().toISOString(),
        pagination: {
          page: validatedInput.page || 1,
          limit: validatedInput.limit || 20,
          total: projects.length,
          totalPages: Math.ceil(projects.length / (validatedInput.limit || 20)),
          hasNext: (validatedInput.page || 1) < Math.ceil(projects.length / (validatedInput.limit || 20)),
          hasPrev: (validatedInput.page || 1) > 1,
        }
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to search projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}