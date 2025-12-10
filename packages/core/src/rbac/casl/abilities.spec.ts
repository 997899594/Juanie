import { describe, expect, it } from 'vitest'
import { defineAbilitiesFor } from './abilities'
import type { AbilityOrgMember, AbilityProjectMember, AbilityUser } from './types'

describe('CASL Abilities', () => {
  const user: AbilityUser = { id: 'user-1' }

  describe('Organization Owner', () => {
    const orgMember: AbilityOrgMember = {
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'owner',
    }

    it('should have all permissions', () => {
      const ability = defineAbilitiesFor(user, orgMember)

      expect(ability.can('manage', 'all')).toBe(true)
      expect(ability.can('create', 'Project')).toBe(true)
      expect(ability.can('delete', 'Project')).toBe(true)
      expect(ability.can('delete', 'Organization')).toBe(true)
    })
  })

  describe('Organization Admin', () => {
    const orgMember: AbilityOrgMember = {
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'admin',
    }

    it('should be able to create projects', () => {
      const ability = defineAbilitiesFor(user, orgMember)

      expect(ability.can('create', 'Project')).toBe(true)
      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('update', 'Project')).toBe(true)
    })

    it('should NOT be able to delete projects', () => {
      const ability = defineAbilitiesFor(user, orgMember)

      expect(ability.can('delete', 'Project')).toBe(false)
    })

    it('should NOT be able to delete organization', () => {
      const ability = defineAbilitiesFor(user, orgMember)

      expect(ability.can('delete', 'Organization')).toBe(false)
    })

    it('should be able to manage teams', () => {
      const ability = defineAbilitiesFor(user, orgMember)

      expect(ability.can('manage_teams', 'Organization')).toBe(true)
    })
  })

  describe('Organization Member', () => {
    const orgMember: AbilityOrgMember = {
      userId: 'user-1',
      organizationId: 'org-1',
      role: 'member',
    }

    it('should only be able to read', () => {
      const ability = defineAbilitiesFor(user, orgMember)

      expect(ability.can('read', 'Organization')).toBe(true)
      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('read', 'Environment')).toBe(true)
    })

    it('should NOT be able to create or update', () => {
      const ability = defineAbilitiesFor(user, orgMember)

      expect(ability.can('create', 'Project')).toBe(false)
      expect(ability.can('update', 'Project')).toBe(false)
      expect(ability.can('delete', 'Project')).toBe(false)
    })
  })

  describe('Project Owner', () => {
    const projectMembers: AbilityProjectMember[] = [
      {
        userId: 'user-1',
        projectId: 'project-1',
        role: 'owner',
      },
    ]

    it('should have full project control', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('update', 'Project')).toBe(true)
      expect(ability.can('delete', 'Project')).toBe(true)
      expect(ability.can('manage_members', 'Project')).toBe(true)
      expect(ability.can('manage_settings', 'Project')).toBe(true)
    })
  })

  describe('Project Maintainer', () => {
    const projectMembers: AbilityProjectMember[] = [
      {
        userId: 'user-1',
        projectId: 'project-1',
        role: 'maintainer',
      },
    ]

    it('should be able to manage project but not delete', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('update', 'Project')).toBe(true)
      expect(ability.can('delete', 'Project')).toBe(false)
      expect(ability.can('manage_members', 'Project')).toBe(true)
    })

    it('should be able to manage environments', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('create', 'Environment')).toBe(true)
      expect(ability.can('read', 'Environment')).toBe(true)
      expect(ability.can('update', 'Environment')).toBe(true)
      expect(ability.can('delete', 'Environment')).toBe(true)
    })
  })

  describe('Project Admin (alias for Maintainer)', () => {
    const projectMembers: AbilityProjectMember[] = [
      {
        userId: 'user-1',
        projectId: 'project-1',
        role: 'admin',
      },
    ]

    it('should have same permissions as maintainer', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('update', 'Project')).toBe(true)
      expect(ability.can('delete', 'Project')).toBe(false)
      expect(ability.can('manage_members', 'Project')).toBe(true)
    })
  })

  describe('Project Developer', () => {
    const projectMembers: AbilityProjectMember[] = [
      {
        userId: 'user-1',
        projectId: 'project-1',
        role: 'developer',
      },
    ]

    it('should be able to read and update project', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('update', 'Project')).toBe(true)
    })

    it('should NOT be able to delete project or manage members', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('delete', 'Project')).toBe(false)
      expect(ability.can('manage_members', 'Project')).toBe(false)
    })

    it('should be able to deploy', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('deploy', 'Deployment')).toBe(true)
      expect(ability.can('read', 'Deployment')).toBe(true)
    })
  })

  describe('Project Member (alias for Developer)', () => {
    const projectMembers: AbilityProjectMember[] = [
      {
        userId: 'user-1',
        projectId: 'project-1',
        role: 'member',
      },
    ]

    it('should have same permissions as developer', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('update', 'Project')).toBe(true)
      expect(ability.can('delete', 'Project')).toBe(false)
    })

    it('should be able to deploy', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('deploy', 'Deployment')).toBe(true)
      expect(ability.can('read', 'Deployment')).toBe(true)
    })
  })

  describe('Project Viewer', () => {
    const projectMembers: AbilityProjectMember[] = [
      {
        userId: 'user-1',
        projectId: 'project-1',
        role: 'viewer',
      },
    ]

    it('should only be able to read', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('read', 'Environment')).toBe(true)
      expect(ability.can('read', 'Deployment')).toBe(true)
    })

    it('should NOT be able to update or delete', () => {
      const ability = defineAbilitiesFor(user, undefined, projectMembers)

      expect(ability.can('update', 'Project')).toBe(false)
      expect(ability.can('delete', 'Project')).toBe(false)
      expect(ability.can('deploy', 'Deployment')).toBe(false)
    })
  })

  describe('Combined Permissions', () => {
    it('should combine org and project permissions', () => {
      const orgMember: AbilityOrgMember = {
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
      }

      const projectMembers: AbilityProjectMember[] = [
        {
          userId: 'user-1',
          projectId: 'project-1',
          role: 'owner',
        },
      ]

      const ability = defineAbilitiesFor(user, orgMember, projectMembers)

      // Org member permissions
      expect(ability.can('read', 'Organization')).toBe(true)

      // Project owner permissions
      expect(ability.can('delete', 'Project')).toBe(true)
      expect(ability.can('manage_members', 'Project')).toBe(true)
    })
  })
})
