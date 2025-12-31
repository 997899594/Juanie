import { DATABASE } from '@juanie/core/tokens'
import { GitProviderService, GitSyncLogsService } from '@juanie/service-foundation'
import { Test, TestingModule } from '@nestjs/testing'
import { PinoLogger } from 'nestjs-pino'
import { ConflictResolutionService } from './conflict-resolution.service'

// 创建 PinoLogger mock 类
class MockPinoLogger {
  setContext = jest.fn().mockReturnThis()
  info = jest.fn()
  warn = jest.fn()
  error = jest.fn()
  debug = jest.fn()
  trace = jest.fn()
  fatal = jest.fn()
}

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService
  let _gitProvider: GitProviderService
  let mockLogger: MockPinoLogger

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
      repositories: {
        findFirst: jest.fn(),
      },
      gitConnections: {
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

  const mockGitSyncLogs = {
    create: jest.fn().mockResolvedValue(undefined),
    findByProject: jest.fn().mockResolvedValue([]),
  }

  beforeEach(async () => {
    // 重置所有 mock
    jest.clearAllMocks()

    // 重新创建 logger mock 实例
    mockLogger = new MockPinoLogger()

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
        {
          provide: GitSyncLogsService,
          useValue: mockGitSyncLogs,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
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
      }

      const mockRepository = {
        projectId: 'project-1',
        provider: 'github',
        cloneUrl: 'https://github.com/org/repo.git',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'admin',
          user: {
            id: 'user-1',
            displayName: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitConnection = {
        userId: 'user-1',
        provider: 'github',
        username: 'testuser',
      }

      const mockCollaborators = [
        {
          username: 'testuser',
          permission: 'read', // 应该是 admin
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.repositories.findFirst.mockResolvedValue(mockRepository)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.gitConnections.findFirst.mockResolvedValue(mockGitConnection)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const conflicts = await service.detectProjectMemberConflicts('project-1', 'test-token')

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
      }

      const mockRepository = {
        projectId: 'project-1',
        provider: 'github',
        cloneUrl: 'https://github.com/org/repo.git',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'member',
          user: {
            id: 'user-1',
            displayName: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitConnection = {
        userId: 'user-1',
        provider: 'github',
        username: 'testuser',
      }

      const mockCollaborators: any[] = [] // 空列表

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.repositories.findFirst.mockResolvedValue(mockRepository)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.gitConnections.findFirst.mockResolvedValue(mockGitConnection)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const conflicts = await service.detectProjectMemberConflicts('project-1', 'test-token')

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
      }

      const mockRepository = {
        projectId: 'project-1',
        provider: 'github',
        cloneUrl: 'https://github.com/org/repo.git',
      }

      const mockMembers: any[] = [] // 空列表

      const mockCollaborators = [
        {
          username: 'extrauser',
          permission: 'write',
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.repositories.findFirst.mockResolvedValue(mockRepository)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const conflicts = await service.detectProjectMemberConflicts('project-1', 'test-token')

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
      }

      const mockRepository = {
        projectId: 'project-1',
        provider: 'github',
        cloneUrl: 'https://github.com/org/repo.git',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'member',
          user: {
            id: 'user-1',
            displayName: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitConnection = {
        userId: 'user-1',
        provider: 'github',
        username: 'testuser',
      }

      const mockCollaborators = [
        {
          username: 'testuser',
          permission: 'write', // 正确的权限
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.repositories.findFirst.mockResolvedValue(mockRepository)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.gitConnections.findFirst.mockResolvedValue(mockGitConnection)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const conflicts = await service.detectProjectMemberConflicts('project-1', 'test-token')

      expect(conflicts).toHaveLength(0)
    })
  })

  describe('resolveProjectMemberConflicts', () => {
    it('should resolve permission mismatch conflicts', async () => {
      const mockProject = {
        id: 'project-1',
      }

      const mockRepository = {
        projectId: 'project-1',
        provider: 'github',
        cloneUrl: 'https://github.com/org/repo.git',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'admin',
          user: {
            id: 'user-1',
            displayName: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitConnection = {
        userId: 'user-1',
        provider: 'github',
        username: 'testuser',
      }

      const mockCollaborators = [
        {
          username: 'testuser',
          permission: 'read',
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.repositories.findFirst.mockResolvedValue(mockRepository)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.gitConnections.findFirst.mockResolvedValue(mockGitConnection)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)
      mockGitProvider.updateCollaboratorPermission.mockResolvedValue(undefined)

      const result = await service.resolveProjectMemberConflicts('project-1', 'test-token', {
        autoResolve: true,
        conflictTypes: ['permission_mismatch'],
      })

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockGitProvider.updateCollaboratorPermission).toHaveBeenCalledWith(
        'github',
        'https://github.com/org/repo.git',
        'test-token',
        'testuser',
        'admin',
      )
    })

    it('should resolve missing on git conflicts', async () => {
      const mockProject = {
        id: 'project-1',
      }

      const mockRepository = {
        projectId: 'project-1',
        provider: 'github',
        cloneUrl: 'https://github.com/org/repo.git',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'member',
          user: {
            id: 'user-1',
            displayName: 'Test User',
            email: 'test@example.com',
          },
        },
      ]

      const mockGitConnection = {
        userId: 'user-1',
        provider: 'github',
        username: 'testuser',
      }

      const mockCollaborators: any[] = []

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.repositories.findFirst.mockResolvedValue(mockRepository)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.gitConnections.findFirst.mockResolvedValue(mockGitConnection)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)
      mockGitProvider.addCollaborator.mockResolvedValue(undefined)

      const result = await service.resolveProjectMemberConflicts('project-1', 'test-token', {
        autoResolve: true,
        conflictTypes: ['missing_on_git'],
      })

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(mockGitProvider.addCollaborator).toHaveBeenCalledWith(
        'github',
        'https://github.com/org/repo.git',
        'test-token',
        'testuser',
        'write',
      )
    })

    it('should skip extra on git conflicts by default', async () => {
      const mockProject = {
        id: 'project-1',
      }

      const mockRepository = {
        projectId: 'project-1',
        provider: 'github',
        cloneUrl: 'https://github.com/org/repo.git',
      }

      const mockMembers: any[] = []

      const mockCollaborators = [
        {
          username: 'extrauser',
          permission: 'write',
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.repositories.findFirst.mockResolvedValue(mockRepository)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const result = await service.resolveProjectMemberConflicts('project-1', 'test-token', {
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
      }

      const mockRepository = {
        projectId: 'project-1',
        provider: 'github',
        cloneUrl: 'https://github.com/org/repo.git',
      }

      const mockMembers = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'admin',
          user: {
            id: 'user-1',
            displayName: 'User 1',
            email: 'user1@example.com',
          },
        },
        {
          userId: 'user-2',
          projectId: 'project-1',
          role: 'member',
          user: {
            id: 'user-2',
            displayName: 'User 2',
            email: 'user2@example.com',
          },
        },
      ]

      const mockGitConnection1 = {
        userId: 'user-1',
        provider: 'github',
        username: 'user1',
      }

      const mockGitConnection2 = {
        userId: 'user-2',
        provider: 'github',
        username: 'user2',
      }

      const mockCollaborators = [
        {
          username: 'user1',
          permission: 'read', // 应该是 admin
        },
        // user2 缺失
        {
          username: 'extrauser',
          permission: 'write', // 多余的
        },
      ]

      mockDb.query.projects.findFirst.mockResolvedValue(mockProject)
      mockDb.query.repositories.findFirst.mockResolvedValue(mockRepository)
      mockDb.query.projectMembers.findMany.mockResolvedValue(mockMembers)
      mockDb.query.gitConnections.findFirst
        .mockResolvedValueOnce(mockGitConnection1)
        .mockResolvedValueOnce(mockGitConnection2)
      mockGitProvider.listCollaborators.mockResolvedValue(mockCollaborators)

      const stats = await service.getConflictStats('project-1', 'test-token')

      expect(stats.total).toBe(3)
      expect(stats.byType.permission_mismatch).toBe(1)
      expect(stats.byType.missing_on_git).toBe(1)
      expect(stats.byType.extra_on_git).toBe(1)
      expect(stats.lastChecked).toBeInstanceOf(Date)
    })
  })
})
