import { DATABASE } from '@juanie/core/tokens'
import { GitProviderService } from '@juanie/service-foundation'
import { Test, TestingModule } from '@nestjs/testing'
import { ConflictResolutionService } from './conflict-resolution.service'

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService
  let _gitProvider: GitProviderService

  const mockDb = {
    query: {
      projects: {
        findFirst: jest.fn(),
      },
      projectMembers: {
        findMany: jest.fn(),
      },
      userGitAccounts: {
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn().mockReturnValue({
      values: jest.fn(),
    }),
  }

  const mockGitProvider = {
    listCollaborators: jest.fn(),
    addCollaborator: jest.fn(),
    removeCollaborator: jest.fn(),
    updateCollaboratorPermission: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictResolutionService,
        {
          provide: DATABASE,
          useValue: mockDb,
        },
        {
          provide: GitProviderService,
          useValue: mockGitProvider,
        },
      ],
    }).compile()

    service = module.get<ConflictResolutionService>(ConflictResolutionService)
    _gitProvider = module.get<GitProviderService>(GitProviderService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('detectProjectMemberConflicts', () => {
    it('should detect permission mismatch conflicts', async () => {
      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'admin',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitAccount = {
        userId: 'user-1',
        provider: 'github',
        gitLogin: 'testuser',
        gitUserId: '456',
      }

      const mockCollaborators = [
        {
          gitLogin: 'testuser',
          gitName: 'Test User',
          permission: 'read', // 应该是 admin
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.userGitAccounts.findFirst.mockResolvedValue(mockGitAccount)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const conflicts = await service.detectProjectMemberConflicts('project-1')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]).toMatchObject({
        userId: 'user-1',
        gitLogin: 'testuser',
        systemRole: 'admin',
        gitPermission: 'read',
        expectedGitPermission: 'admin',
        conflictType: 'permission_mismatch',
      })
    })

    it('should detect missing on git conflicts', async () => {
      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'member',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitAccount = {
        userId: 'user-1',
        provider: 'github',
        gitLogin: 'testuser',
        gitUserId: '456',
      }

      const mockCollaborators: any[] = [] // 空列表

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.userGitAccounts.findFirst.mockResolvedValue(mockGitAccount)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const conflicts = await service.detectProjectMemberConflicts('project-1')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]).toMatchObject({
        userId: 'user-1',
        gitLogin: 'testuser',
        systemRole: 'member',
        gitPermission: 'none',
        conflictType: 'missing_on_git',
      })
    })

    it('should detect extra on git conflicts', async () => {
      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      const mockMembers: any[] = [] // 空列表

      const mockCollaborators = [
        {
          gitLogin: 'extrauser',
          gitName: 'Extra User',
          permission: 'write',
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const conflicts = await service.detectProjectMemberConflicts('project-1')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]).toMatchObject({
        gitLogin: 'extrauser',
        systemRole: 'none',
        gitPermission: 'write',
        conflictType: 'extra_on_git',
      })
    })

    it('should return empty array when no conflicts', async () => {
      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'member',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitAccount = {
        userId: 'user-1',
        provider: 'github',
        gitLogin: 'testuser',
        gitUserId: '456',
      }

      const mockCollaborators = [
        {
          gitLogin: 'testuser',
          gitName: 'Test User',
          permission: 'write', // 正确的权限
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.userGitAccounts.findFirst.mockResolvedValue(mockGitAccount)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const conflicts = await service.detectProjectMemberConflicts('project-1')

      expect(conflicts).toHaveLength(0)
    })
  })

  describe('resolveProjectMemberConflicts', () => {
    it('should resolve permission mismatch conflicts', async () => {
      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'admin',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitAccount = {
        userId: 'user-1',
        provider: 'github',
        gitLogin: 'testuser',
        gitUserId: '456',
      }

      const mockCollaborators = [
        {
          gitLogin: 'testuser',
          gitName: 'Test User',
          permission: 'read',
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.userGitAccounts.findFirst.mockResolvedValue(mockGitAccount)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)
      mockGitProvider.updateCollaboratorPermission.mockResolvedValue(undefined)

      const result = await service.resolveProjectMemberConflicts('project-1', {
        autoResolve: true,
        conflictTypes: ['permission_mismatch'],
      })

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockGitProvider.updateCollaboratorPermission).toHaveBeenCalledWith(
        'github',
        '123',
        'testuser',
        'admin',
      )
    })

    it('should resolve missing on git conflicts', async () => {
      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'member',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitAccount = {
        userId: 'user-1',
        provider: 'github',
        gitLogin: 'testuser',
        gitUserId: '456',
      }

      const mockCollaborators: any[] = []

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.userGitAccounts.findFirst.mockResolvedValue(mockGitAccount)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)
      mockGitProvider.addCollaborator.mockResolvedValue(undefined)

      const result = await service.resolveProjectMemberConflicts('project-1', {
        autoResolve: true,
        conflictTypes: ['missing_on_git'],
      })

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockGitProvider.addCollaborator).toHaveBeenCalledWith(
        'github',
        '123',
        'testuser',
        'write',
      )
    })

    it('should skip extra on git conflicts by default', async () => {
      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      const mockMembers: any[] = []

      const mockCollaborators = [
        {
          gitLogin: 'extrauser',
          gitName: 'Extra User',
          permission: 'write',
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const result = await service.resolveProjectMemberConflicts('project-1', {
        autoResolve: true,
        conflictTypes: ['extra_on_git'],
      })

      expect(result.resolved).toBe(0)
      expect(result.skipped).toBe(1)
      expect(mockGitProvider.removeCollaborator).not.toHaveBeenCalled()
    })
  })

  describe('getConflictStats', () => {
    it('should return conflict statistics', async () => {
      const mockProject = {
        id: 'project-1',
        gitProvider: 'github',
        gitRepoId: '123',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'admin',
          user: {
            id: 'user-1',
            name: 'User 1',
            email: 'user1@example.com',
          },
        },
        {
          userId: 'user-2',
          projectId: 'project-1',
          role: 'member',
          user: {
            id: 'user-2',
            name: 'User 2',
            email: 'user2@example.com',
          },
        },
      ]

      const mockGitAccount1 = {
        userId: 'user-1',
        provider: 'github',
        gitLogin: 'user1',
        gitUserId: '456',
      }

      const mockGitAccount2 = {
        userId: 'user-2',
        provider: 'github',
        gitLogin: 'user2',
        gitUserId: '789',
      }

      const mockCollaborators = [
        {
          gitLogin: 'user1',
          permission: 'read', // 应该是 admin
        },
        // user2 缺失
        {
          gitLogin: 'extrauser',
          permission: 'write', // 多余的
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.userGitAccounts.findFirst
        .mockResolvedValueOnce(mockGitAccount1)
        .mockResolvedValueOnce(mockGitAccount2)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const stats = await service.getConflictStats('project-1')

      expect(stats.total).toBe(3)
      expect(stats.byType.permission_mismatch).toBe(1)
      expect(stats.byType.missing_on_git).toBe(1)
      expect(stats.byType.extra_on_git).toBe(1)
      expect(stats.lastChecked).toBeInstanceOf(Date)
    })
  })
})
