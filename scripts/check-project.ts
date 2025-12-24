import * as schema from '@juanie/core/database'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

const projectId = 'a86f955a-bd63-4c5c-a489-aede8543f25f'

const [project] = await db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.id, projectId))
  .limit(1)

console.log('Project:', JSON.stringify(project, null, 2))

// 检查仓库
const repositories = await db
  .select()
  .from(schema.repositories)
  .where(eq(schema.repositories.projectId, projectId))

console.log('\nRepositories:', JSON.stringify(repositories, null, 2))

// 检查 Git 连接
const [gitConnection] = await db
  .select()
  .from(schema.gitConnections)
  .where(eq(schema.gitConnections.userId, project?.userId || ''))
  .limit(1)

console.log('\nGit Connection:', {
  username: gitConnection?.username,
  provider: gitConnection?.provider,
  status: gitConnection?.status,
})

await client.end()
