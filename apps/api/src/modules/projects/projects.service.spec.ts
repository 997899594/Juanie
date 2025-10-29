import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTestDatabase } from '../../../test/test-database'
import {
  clearDatabase,
  createTestOrganization,
  createTestProject,
  createTestUser,
  expectToBeUUID,
  expectToHaveTimestamps,
} from '../../../test/utils'
import { ProjectsService } from './projects.service'

describe('ProjectsService', () => {
  let service: ProjectsService
  let testUser: any
  let testOrg: any

  beforeEach(async () => {
    const db = getTestDatabase()
    service = new ProjectsService(db)

    testUser = await createTestUser()
    testOrg = await createTestOrganization(testUser.id)
  })

  afterEach(async () => {
    await clearDatabase()
  })

  describe('create', () => {
    it('should create project', async () => {
      const projectData = {
        organizationId: testOrg.id,
        name: 'Test Project',
        slug: 'test-project',
        description: 'Test description',
      }

      const project = await service.create(testUser.id, projectData)

      expect(project).toBeDefined()
      expectToBeUUID(project.id)
      expect(project.name).toBe(projectData.name)
      expect(project.slug).toBe(projectData.slug)
      expectToHaveTimestamps(project)
    })
  })

  describe('list', () => {
    it('should list organization projects', async () => {
      await createTestProject(testOrg.id, { name: 'Project 1' })
      await createTestProject(testOrg.id, { name: 'Project 2' })

      const projects = await service.list(testOrg.id, testUser.id)

      expect(projects).toHaveLength(2)
    })
  })

  describe('get', () => {
    it('should get project details', async () => {
      const project = await createTestProject(testOrg.id)

      const result = await service.get(project.id, testUser.id)

      expect(result).toBeDefined()
      expect(result?.id).toBe(project.id)
    })
  })
})
