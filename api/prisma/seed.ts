import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@devops.com' },
    update: {},
    create: {
      email: 'admin@devops.com',
      passwordHash: adminPassword,
      name: '系统管理员',
      role: 'ADMIN',
    },
  })

  // Create DevOps engineer user
  const devopsPassword = await bcrypt.hash('devops123', 10)
  const devopsUser = await prisma.user.upsert({
    where: { email: 'devops@devops.com' },
    update: {},
    create: {
      email: 'devops@devops.com',
      passwordHash: devopsPassword,
      name: 'DevOps工程师',
      role: 'MENTOR',
    },
  })

  // Create developer user
  const developerPassword = await bcrypt.hash('dev123', 10)
  const developerUser = await prisma.user.upsert({
    where: { email: 'developer@devops.com' },
    update: {},
    create: {
      email: 'developer@devops.com',
      passwordHash: developerPassword,
      name: '开发者',
      role: 'LEARNER',
    },
  })

  console.log('Created users:', { adminUser, devopsUser, developerUser })

  // Create sample projects
  const project1 = await prisma.project.create({
    data: {
      name: 'DevOps Platform',
      description: 'A comprehensive DevOps platform for CI/CD',
      githubRepo: 'https://github.com/example/devops-platform',
      status: 'ACTIVE',
      techStack: ['Node.js', 'Vue.js', 'PostgreSQL'],
      learningObjectives: ['CI/CD', 'DevOps', 'Kubernetes'],
      createdBy: adminUser.id,
    },
  })

  const project2 = await prisma.project.create({
    data: {
      name: 'Microservices API',
      description: 'RESTful API built with microservices architecture',
      githubRepo: 'https://github.com/example/microservices-api',
      status: 'ACTIVE',
      techStack: ['Node.js', 'NestJS', 'Docker'],
      learningObjectives: ['Microservices', 'API Design', 'Docker'],
      createdBy: adminUser.id,
    },
  })

  console.log('Created projects:', { project1, project2 })

  // Create sample pipelines
  const pipeline1 = await prisma.pipeline.create({
    data: {
      projectId: project1.id,
      gitlabPipelineId: 1,
      status: 'SUCCESS',
      stages: [
        { name: 'build', commands: ['npm install', 'npm run build'] },
        { name: 'test', commands: ['npm test'] },
        { name: 'deploy', commands: ['npm run deploy'] }
      ]
    },
  })

  const pipeline2 = await prisma.pipeline.create({
    data: {
      projectId: project2.id,
      gitlabPipelineId: 2,
      status: 'SUCCESS',
      stages: [
        { name: 'test', commands: ['npm run test:api'] },
        { name: 'integration', commands: ['npm run test:integration'] }
      ]
    },
  })

  console.log('Created pipelines:', { pipeline1, pipeline2 })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })