import { DATABASE } from '@juanie/core/tokens'
import { Test, TestingModule } from '@nestjs/testing'
import { ProjectMembersService } from '../../projects/project-members.service'
import { ProjectsService } from '../../projects/projects.service'
import { GitPlatformSyncService } from './git-platform-sync.service'

describe('GitPlatformSyncService', () => {
  let service: GitPlatformSyncService
  let _projectMembersService: ProjectMembersService
  let _projectsService: ProjectsService

  const mockDb = {
    query: {
      projects: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      userGitAccounts: {
        findFirst: jest.fn(),
      },
      projectMembers: {
        findFirst: jest.fn(),
      },
    },
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn(),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn(),
    }),
  }

  const mockProjectMembersService = {
    addMember: jest.fn(),
    removeMember: jest.fn(),
  }

  const mockProjectsService = {}

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitPlatformSyncService,
        {
          provide: DATABASE,
          useValue: mockDb,
        },
        {
          provide: ProjectMembersService,
          useValue: mockProjectMembersService,
        },
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
      ],
    }).compile()

    service = module.get<GitPlatformSyncService>(GitPlatformSyncService)
    _projectMembersService = module.get<ProjectMembersService>(ProjectMembersService)
    _projectsService = module.get<ProjectsService>(ProjectsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('handleRepositoryDeleted', () => {
    it('should disconnect projects when repository is deleted', async () => {
      const event = {
        provider: 'github' as const,
        repository: {
          gitId: '123',
          name: 'test-repo',
          fullName: 'org/test-repo',
        },
        timestamp: new Date(),
      }

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          gitProvider: 'github',
          gitRepoId: '123',
          createdBy: 'user-1',
        },
      ]

      mockDb.query.projects.findMany.mockResolvedValue(mockProjects)

      await service.handleRepositoryDeleted(event)

      expect(mockDb.query.projects.findMany).toHaveBeenCalled()
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should handle no projects found', async () => {
      const event = {
        provider: 'github' as const,
        repository: {
          gitId: '123',
          name: 'test-repo',
          fullName: 'org/test-repo',
        },
        timestamp: new Date(),
      }

      mockDb.query.projects.findMany.mockResolvedValue([])

      await service.handleRepositoryDeleted(event)

      expect(mockDb.query.projects.findMany).toHaveBeenCalled()
      expect(mockDb.update).not.toHaveBeenCalled()
    })
  })

  describe('handleCollaboratorAdded', () => {
    it('should add user as project member when collaborator is added', async () => {
      const event = {
        provider: 'github' as const,
        repository: {
          gitId: '123',
          name: 'test-repo',
          fullName: 'org/test-repo',
        },
        collaborator: {
          gitId: '456',
          gitLogin: 'testuser',
          gitName: 'Test User',
          permission: 'write',
        },
        timestamp: new Date(),
      }

      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        gitProvider: 'github',
        gitRepoId: '123',
        createdBy: 'user-1',
      }

      const mockGitAccount = {
        userId: 'user-2',
        provider: 'github',
        gitUserId: '456',
      }

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.userGitAccounts.findFirst.mockResolvedValue(mockGitAccount)
      mockDb.query.projectMembers.findFirst.mockResolvedValue(null)

      await service.handleCollaboratorAdded(event)

      expect(mockDb.query.projects.findFirst).toHaveBeenCalled()
      expect(mockDb.query.userGitAccounts.findFirst).toHaveBeenCalled()
      expect(mockProjectMembersService.addMember).toHaveBeenCalledWith({
        projectId: 'project-1',
        userId: 'user-2',
        role: 'member',
        addedBy: 'user-1',
      })
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should skip if user is not linked', async () => {
      const event = {
        provider: 'github' as const,
        repository: {
          gitId: '123',
          name: 'test-repo',
          fullName: 'org/test-repo',
        },
        collaborator: {
          gitId: '456',
          gitLogin: 'testuser',
          permission: 'write',
        },
        timestamp: new Date(),
      }

      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.userGitAccounts.findFirst.mockResolvedValue(null)

      await service.handleCollaboratorAdded(event)

      expect(mockProjectMembersService.addMember).not.toHaveBeenCalled()
      expect(mockDb.insert).toHaveBeenCalled() // Log entry
    })
  })

  describe('handleCollaboratorRemoved', () => {
    it('should remove user from project when collaborator is removed', async () => {
      const event = {
        provider: 'github' as const,
        repository: {
          gitId: '123',
          name: 'test-repo',
          fullName: 'org/test-repo',
        },
        collaborator: {
          gitId: '456',
          gitLogin: 'testuser',
        },
        timestamp: new Date(),
      }

      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        gitProvider: 'github',
        gitRepoId: '123',
        createdBy: 'user-1',
      }

      const mockGitAccount = {
        userId: 'user-2',
        provider: 'github',
        gitUserId: '456',
      }

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.userGitAccounts.findFirst.mockResolvedValue(mockGitAccount)

      await service.handleCollaboratorRemoved(event)

      expect(mockDb.query.projects.findFirst).toHaveBeenCalled()
      expect(mockDb.query.userGitAccounts.findFirst).toHaveBeenCalled()
      expect(mockProjectMembersService.removeMember).toHaveBeenCalledWith({
        projectId: 'project-1',
        userId: 'user-2',
        removedBy: 'user-1',
      })
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('handleRepositoryUpdated', () => {
    it('should update project when repository settings change', async () => {
      const event = {
        provider: 'github' as const,
        repository: {
          gitId: '123',
          name: 'new-repo-name',
          fullName: 'org/new-repo-name',
          url: 'https://github.com/org/new-repo-name',
        },
        changes: {
          name: { from: 'old-repo-name', to: 'new-repo-name' },
        },
        timestamp: new Date(),
      }

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          gitProvider: 'github',
          gitRepoId: '123',
        },
      ]

      mockDb.query.projects.findMany.mockResolvedValue(mockProjects)

      await service.handleRepositoryUpdated(event)

      expect(mockDb.query.projects.findMany).toHaveBeenCalled()
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('mapGitPermissionToProjectRole', () => {
    it('should map GitHub permissions correctly', () => {
      // @ts-expect-error - accessing private method for testing
      expect(service.mapGitPermissionToProjectRole('admin')).toBe('admin')
      // @ts-expect-error
      expect(service.mapGitPermissionToProjectRole('write')).toBe('member')
      // @ts-expect-error
      expect(service.mapGitPermissionToProjectRole('read')).toBe('viewer')
    })

    it('should map GitLab permissions correctly', () => {
      // @ts-expect-error - accessing private method for testing
      expect(service.mapGitPermissionToProjectRole('maintainer')).toBe('admin')
      // @ts-expect-error
      expect(service.mapGitPermissionToProjectRole('developer')).toBe('member')
      // @ts-expect-error
      expect(service.mapGitPermissionToProjectRole('reporter')).toBe('viewer')
    })

    it('should default to viewer for unknown permissions', () => {
      // @ts-expect-error - accessing private method for testing
      expect(service.mapGitPermissionToProjectRole('unknown')).toBe('viewer')
    })
  })
})
