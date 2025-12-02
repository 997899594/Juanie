import { describe, expect, it } from 'vitest'
import {
  GitHubOrganizationRole,
  GitHubRepositoryPermission,
  GitLabAccessLevel,
  isValidGitPermission,
  isValidOrganizationRole,
  isValidProjectRole,
  mapGitHubOrgRoleToOrgRole,
  mapGitHubPermissionToGitPermission,
  mapGitLabAccessLevelToGitPermission,
  mapGitPermissionToGitHubPermission,
  mapGitPermissionToGitLabAccessLevel,
  mapOrgRoleToGitHubOrgRole,
  mapOrgRoleToGitPermission,
  mapPermissionForProvider,
  mapPermissionFromProvider,
  mapProjectRoleToGitPermission,
} from './permission-mapper'

describe('Permission Mapper', () => {
  describe('mapProjectRoleToGitPermission', () => {
    it('should map owner to admin', () => {
      expect(mapProjectRoleToGitPermission('owner')).toBe('admin')
    })

    it('should map maintainer to admin', () => {
      expect(mapProjectRoleToGitPermission('maintainer')).toBe('admin')
    })

    it('should map developer to write', () => {
      expect(mapProjectRoleToGitPermission('developer')).toBe('write')
    })

    it('should map viewer to read', () => {
      expect(mapProjectRoleToGitPermission('viewer')).toBe('read')
    })

    it('should default to read for unknown roles', () => {
      expect(mapProjectRoleToGitPermission('unknown' as any)).toBe('read')
    })
  })

  describe('mapOrgRoleToGitPermission', () => {
    it('should map owner to admin', () => {
      expect(mapOrgRoleToGitPermission('owner')).toBe('admin')
    })

    it('should map admin to admin', () => {
      expect(mapOrgRoleToGitPermission('admin')).toBe('admin')
    })

    it('should map member to write', () => {
      expect(mapOrgRoleToGitPermission('member')).toBe('write')
    })

    it('should map billing to read', () => {
      expect(mapOrgRoleToGitPermission('billing')).toBe('read')
    })

    it('should default to read for unknown roles', () => {
      expect(mapOrgRoleToGitPermission('unknown' as any)).toBe('read')
    })
  })

  describe('GitLab Access Level Mapping', () => {
    it('should map admin to Maintainer (40)', () => {
      expect(mapGitPermissionToGitLabAccessLevel('admin')).toBe(GitLabAccessLevel.Maintainer)
    })

    it('should map write to Developer (30)', () => {
      expect(mapGitPermissionToGitLabAccessLevel('write')).toBe(GitLabAccessLevel.Developer)
    })

    it('should map read to Reporter (20)', () => {
      expect(mapGitPermissionToGitLabAccessLevel('read')).toBe(GitLabAccessLevel.Reporter)
    })

    it('should map Maintainer (40) to admin', () => {
      expect(mapGitLabAccessLevelToGitPermission(GitLabAccessLevel.Maintainer)).toBe('admin')
    })

    it('should map Owner (50) to admin', () => {
      expect(mapGitLabAccessLevelToGitPermission(GitLabAccessLevel.Owner)).toBe('admin')
    })

    it('should map Developer (30) to write', () => {
      expect(mapGitLabAccessLevelToGitPermission(GitLabAccessLevel.Developer)).toBe('write')
    })

    it('should map Reporter (20) to read', () => {
      expect(mapGitLabAccessLevelToGitPermission(GitLabAccessLevel.Reporter)).toBe('read')
    })

    it('should map Guest (10) to read', () => {
      expect(mapGitLabAccessLevelToGitPermission(GitLabAccessLevel.Guest)).toBe('read')
    })
  })

  describe('GitHub Permission Mapping', () => {
    it('should map admin to Admin', () => {
      expect(mapGitPermissionToGitHubPermission('admin')).toBe(GitHubRepositoryPermission.Admin)
    })

    it('should map write to Write', () => {
      expect(mapGitPermissionToGitHubPermission('write')).toBe(GitHubRepositoryPermission.Write)
    })

    it('should map read to Read', () => {
      expect(mapGitPermissionToGitHubPermission('read')).toBe(GitHubRepositoryPermission.Read)
    })

    it('should map Admin to admin', () => {
      expect(mapGitHubPermissionToGitPermission(GitHubRepositoryPermission.Admin)).toBe('admin')
    })

    it('should map Maintain to admin', () => {
      expect(mapGitHubPermissionToGitPermission(GitHubRepositoryPermission.Maintain)).toBe('admin')
    })

    it('should map Write to write', () => {
      expect(mapGitHubPermissionToGitPermission(GitHubRepositoryPermission.Write)).toBe('write')
    })

    it('should map Triage to write', () => {
      expect(mapGitHubPermissionToGitPermission(GitHubRepositoryPermission.Triage)).toBe('write')
    })

    it('should map Read to read', () => {
      expect(mapGitHubPermissionToGitPermission(GitHubRepositoryPermission.Read)).toBe('read')
    })
  })

  describe('GitHub Organization Role Mapping', () => {
    it('should map owner to Admin', () => {
      expect(mapOrgRoleToGitHubOrgRole('owner')).toBe(GitHubOrganizationRole.Admin)
    })

    it('should map admin to Admin', () => {
      expect(mapOrgRoleToGitHubOrgRole('admin')).toBe(GitHubOrganizationRole.Admin)
    })

    it('should map member to Member', () => {
      expect(mapOrgRoleToGitHubOrgRole('member')).toBe(GitHubOrganizationRole.Member)
    })

    it('should map billing to Member', () => {
      expect(mapOrgRoleToGitHubOrgRole('billing')).toBe(GitHubOrganizationRole.Member)
    })

    it('should map Admin to admin', () => {
      expect(mapGitHubOrgRoleToOrgRole(GitHubOrganizationRole.Admin)).toBe('admin')
    })

    it('should map Member to member', () => {
      expect(mapGitHubOrgRoleToOrgRole(GitHubOrganizationRole.Member)).toBe('member')
    })
  })

  describe('Provider-Specific Mapping', () => {
    it('should map GitHub admin permission correctly', () => {
      expect(mapPermissionForProvider('github', 'admin')).toBe('admin')
    })

    it('should map GitLab admin permission correctly', () => {
      expect(mapPermissionForProvider('gitlab', 'admin')).toBe(40)
    })

    it('should map GitHub write permission correctly', () => {
      expect(mapPermissionForProvider('github', 'write')).toBe('write')
    })

    it('should map GitLab write permission correctly', () => {
      expect(mapPermissionForProvider('gitlab', 'write')).toBe(30)
    })

    it('should map from GitHub admin permission', () => {
      expect(mapPermissionFromProvider('github', 'admin')).toBe('admin')
    })

    it('should map from GitLab admin permission', () => {
      expect(mapPermissionFromProvider('gitlab', 40)).toBe('admin')
    })

    it('should map from GitHub write permission', () => {
      expect(mapPermissionFromProvider('github', 'write')).toBe('write')
    })

    it('should map from GitLab write permission', () => {
      expect(mapPermissionFromProvider('gitlab', 30)).toBe('write')
    })
  })

  describe('Validation Functions', () => {
    it('should validate valid Git permissions', () => {
      expect(isValidGitPermission('read')).toBe(true)
      expect(isValidGitPermission('write')).toBe(true)
      expect(isValidGitPermission('admin')).toBe(true)
    })

    it('should reject invalid Git permissions', () => {
      expect(isValidGitPermission('invalid')).toBe(false)
      expect(isValidGitPermission('owner')).toBe(false)
    })

    it('should validate valid project roles', () => {
      expect(isValidProjectRole('owner')).toBe(true)
      expect(isValidProjectRole('maintainer')).toBe(true)
      expect(isValidProjectRole('developer')).toBe(true)
      expect(isValidProjectRole('viewer')).toBe(true)
    })

    it('should reject invalid project roles', () => {
      expect(isValidProjectRole('invalid')).toBe(false)
      expect(isValidProjectRole('admin')).toBe(false)
    })

    it('should validate valid organization roles', () => {
      expect(isValidOrganizationRole('owner')).toBe(true)
      expect(isValidOrganizationRole('admin')).toBe(true)
      expect(isValidOrganizationRole('member')).toBe(true)
      expect(isValidOrganizationRole('billing')).toBe(true)
    })

    it('should reject invalid organization roles', () => {
      expect(isValidOrganizationRole('invalid')).toBe(false)
      expect(isValidOrganizationRole('developer')).toBe(false)
    })
  })

  describe('Round-trip Mapping', () => {
    it('should maintain consistency for GitHub permissions', () => {
      const permissions: Array<'read' | 'write' | 'admin'> = ['read', 'write', 'admin']

      for (const permission of permissions) {
        const githubPerm = mapGitPermissionToGitHubPermission(permission)
        const backToGit = mapGitHubPermissionToGitPermission(githubPerm)
        expect(backToGit).toBe(permission)
      }
    })

    it('should maintain consistency for GitLab permissions', () => {
      const permissions: Array<'read' | 'write' | 'admin'> = ['read', 'write', 'admin']

      for (const permission of permissions) {
        const gitlabLevel = mapGitPermissionToGitLabAccessLevel(permission)
        const backToGit = mapGitLabAccessLevelToGitPermission(gitlabLevel)
        expect(backToGit).toBe(permission)
      }
    })

    it('should maintain consistency for project roles', () => {
      const roles: Array<'owner' | 'maintainer' | 'developer' | 'viewer'> = [
        'owner',
        'maintainer',
        'developer',
        'viewer',
      ]

      for (const role of roles) {
        const gitPermission = mapProjectRoleToGitPermission(role)
        expect(isValidGitPermission(gitPermission)).toBe(true)
      }
    })

    it('should maintain consistency for organization roles', () => {
      const roles: Array<'owner' | 'admin' | 'member' | 'billing'> = [
        'owner',
        'admin',
        'member',
        'billing',
      ]

      for (const role of roles) {
        const gitPermission = mapOrgRoleToGitPermission(role)
        expect(isValidGitPermission(gitPermission)).toBe(true)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle case-insensitive permission strings', () => {
      expect(mapGitHubPermissionToGitPermission('ADMIN')).toBe('read')
      expect(mapGitHubPermissionToGitPermission('admin')).toBe('admin')
    })

    it('should handle numeric access levels outside defined range', () => {
      expect(mapGitLabAccessLevelToGitPermission(100)).toBe('admin')
      expect(mapGitLabAccessLevelToGitPermission(0)).toBe('read')
      expect(mapGitLabAccessLevelToGitPermission(-1)).toBe('read')
    })

    it('should provide safe defaults for unknown values', () => {
      expect(mapProjectRoleToGitPermission('unknown' as any)).toBe('read')
      expect(mapOrgRoleToGitPermission('unknown' as any)).toBe('read')
      expect(mapGitHubPermissionToGitPermission('unknown')).toBe('read')
    })
  })
})
