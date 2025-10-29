import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTestDatabase } from '../../../test/test-database'
import {
  clearDatabase,
  createTestOrganization,
  createTestUser,
  expectNotToBeDeleted,
  expectToBeDeleted,
  expectToBeUUID,
  expectToHaveTimestamps,
} from '../../../test/utils'
import { OrganizationsService } from './organizations.service'

describe('OrganizationsService', () => {
  let service: OrganizationsService
  let testUser: any
  let testUser2: any

  beforeEach(async () => {
    const db = getTestDatabase()
    service = new OrganizationsService(db)

    // 创建测试用户
    testUser = await createTestUser()
    testUser2 = await createTestUser()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  describe('create', () => {
    it('should create organization and add creator as owner', async () => {
      const orgData = {
        name: 'Test Org',
        slug: 'test-org',
        displayName: 'Test Organization',
      }

      const org = await service.create(testUser.id, orgData)

      expect(org).toBeDefined()
      expectToBeUUID(org.id)
      expect(org.name).toBe(orgData.name)
      expect(org.slug).toBe(orgData.slug)
      expect(org.displayName).toBe(orgData.displayName)
      expectToHaveTimestamps(org)
      expectNotToBeDeleted(org)

      // 验证创建者是 owner
      const members = await service.listMembers(org.id, testUser.id)
      expect(members).toHaveLength(1)
      expect(members[0].role).toBe('owner')
      expect(members[0].user.id).toBe(testUser.id)
    })

    it('should create organization with default quotas', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      expect(org.quotas).toBeDefined()
      expect(org.quotas.maxProjects).toBe(10)
      expect(org.quotas.maxUsers).toBe(50)
      expect(org.quotas.maxStorageGb).toBe(100)
    })
  })

  describe('list', () => {
    it('should list user organizations', async () => {
      const org1 = await service.create(testUser.id, {
        name: 'Org 1',
        slug: 'org-1',
      })

      const org2 = await service.create(testUser.id, {
        name: 'Org 2',
        slug: 'org-2',
      })

      const orgs = await service.list(testUser.id)

      expect(orgs).toHaveLength(2)
      expect(orgs.map((o) => o.id)).toContain(org1.id)
      expect(orgs.map((o) => o.id)).toContain(org2.id)
    })

    it('should not list deleted organizations', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      await service.delete(org.id, testUser.id)

      const orgs = await service.list(testUser.id)
      expect(orgs).toHaveLength(0)
    })

    it('should only list organizations user is member of', async () => {
      await service.create(testUser.id, {
        name: 'User 1 Org',
        slug: 'user-1-org',
      })

      await service.create(testUser2.id, {
        name: 'User 2 Org',
        slug: 'user-2-org',
      })

      const user1Orgs = await service.list(testUser.id)
      const user2Orgs = await service.list(testUser2.id)

      expect(user1Orgs).toHaveLength(1)
      expect(user2Orgs).toHaveLength(1)
      expect(user1Orgs[0].name).toBe('User 1 Org')
      expect(user2Orgs[0].name).toBe('User 2 Org')
    })
  })

  describe('get', () => {
    it('should get organization details', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      const result = await service.get(org.id, testUser.id)

      expect(result).toBeDefined()
      expect(result?.id).toBe(org.id)
      expect(result?.name).toBe('Test Org')
      expect(result?.role).toBe('owner')
    })

    it('should return null if user is not member', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      const result = await service.get(org.id, testUser2.id)

      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('should update organization as owner', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      const updated = await service.update(org.id, testUser.id, {
        name: 'Updated Org',
        displayName: 'Updated Display Name',
      })

      expect(updated.name).toBe('Updated Org')
      expect(updated.displayName).toBe('Updated Display Name')
    })

    it('should throw error if user is not owner or admin', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      // 添加 testUser2 为普通成员
      await service.inviteMember(org.id, testUser.id, {
        invitedUserId: testUser2.id,
        role: 'member',
      })

      await expect(service.update(org.id, testUser2.id, { name: 'Hacked Org' })).rejects.toThrow(
        '没有权限更新组织',
      )
    })
  })

  describe('delete', () => {
    it('should soft delete organization as owner', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      await service.delete(org.id, testUser.id)

      // 验证软删除
      const orgs = await service.list(testUser.id)
      expect(orgs).toHaveLength(0)
    })

    it('should throw error if user is not owner', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      await service.inviteMember(org.id, testUser.id, {
        invitedUserId: testUser2.id,
        role: 'admin',
      })

      await expect(service.delete(org.id, testUser2.id)).rejects.toThrow(
        '只有组织所有者可以删除组织',
      )
    })
  })

  describe('inviteMember', () => {
    it('should invite member as owner', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      const member = await service.inviteMember(org.id, testUser.id, {
        invitedUserId: testUser2.id,
        role: 'admin',
      })

      expect(member).toBeDefined()
      expect(member.userId).toBe(testUser2.id)
      expect(member.role).toBe('admin')
    })

    it('should throw error if user already member', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      await service.inviteMember(org.id, testUser.id, {
        invitedUserId: testUser2.id,
        role: 'member',
      })

      await expect(
        service.inviteMember(org.id, testUser.id, {
          invitedUserId: testUser2.id,
          role: 'admin',
        }),
      ).rejects.toThrow('用户已经是组织成员')
    })
  })

  describe('listMembers', () => {
    it('should list organization members', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      await service.inviteMember(org.id, testUser.id, {
        invitedUserId: testUser2.id,
        role: 'member',
      })

      const members = await service.listMembers(org.id, testUser.id)

      expect(members).toHaveLength(2)
      expect(members.map((m) => m.user.id)).toContain(testUser.id)
      expect(members.map((m) => m.user.id)).toContain(testUser2.id)
    })
  })

  describe('updateMemberRole', () => {
    it('should update member role as owner', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      const member = await service.inviteMember(org.id, testUser.id, {
        invitedUserId: testUser2.id,
        role: 'member',
      })

      const updated = await service.updateMemberRole(org.id, testUser.id, {
        memberId: member.id,
        role: 'admin',
      })

      expect(updated.role).toBe('admin')
    })
  })

  describe('removeMember', () => {
    it('should remove member as owner', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      const member = await service.inviteMember(org.id, testUser.id, {
        invitedUserId: testUser2.id,
        role: 'member',
      })

      await service.removeMember(org.id, testUser.id, {
        memberId: member.id,
      })

      const members = await service.listMembers(org.id, testUser.id)
      expect(members).toHaveLength(1)
      expect(members[0].user.id).toBe(testUser.id)
    })
  })

  describe('getQuotaUsage', () => {
    it('should return quota usage', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      const usage = await service.getQuotaUsage(org.id, testUser.id)

      expect(usage).toBeDefined()
      expect(usage.quotas).toBeDefined()
      expect(usage.usage).toBeDefined()
      expect(usage.usage.projects).toBe(0)
      expect(usage.usage.members).toBe(1)
    })
  })

  describe('checkQuota', () => {
    it('should check project quota', async () => {
      const org = await service.create(testUser.id, {
        name: 'Test Org',
        slug: 'test-org',
      })

      const canCreate = await service.checkQuota(org.id, 'projects')
      expect(canCreate).toBe(true)
    })
  })
})
