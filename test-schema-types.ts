import * as schema from './packages/core/src/database/schemas'

// 测试 Organization 类型
type Org = typeof schema.organizations.$inferSelect

const testOrg: Org = {
  id: 'test',
  name: 'test',
  slug: 'test',
  displayName: null,
  logoUrl: null,
  type: 'team', // 这应该是 'personal' | 'team'
  ownerId: null,
  quotas: { maxProjects: 10, maxUsers: 50, maxStorageGb: 100 },
  billing: null,
  gitProvider: 'github', // 这应该是 'github' | 'gitlab' | null
  gitOrgId: null,
  gitOrgName: null,
  gitOrgUrl: null,
  gitSyncEnabled: false,
  gitLastSyncAt: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

console.log('Organization type:', testOrg.type)
console.log('Git provider:', testOrg.gitProvider)
