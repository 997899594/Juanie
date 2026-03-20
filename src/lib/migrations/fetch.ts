import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, repositories } from '@/lib/db/schema';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';

interface MigrationFile {
  name: string;
  content: string;
}

export async function fetchMigrationFilesFromRepoPath(
  projectId: string,
  path: string,
  branch: string = 'main'
): Promise<MigrationFile[]> {
  // 获取项目和仓库信息
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (!project.repositoryId) {
    throw new Error('Project has no repository');
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (!repo) {
    throw new Error('Repository not found');
  }

  // 获取 Git provider session
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: ['read_repo'],
  });

  if (!session) {
    throw new Error('No Git integration found');
  }

  try {
    // 列出目录内容
    const contents = await gateway.listDirectory(session, repo.fullName, path, branch);

    // 过滤出迁移文件（.sql 或 .js）
    const migrationFiles = contents.filter(
      (item) => item.type === 'file' && (item.name.endsWith('.sql') || item.name.endsWith('.js'))
    );

    // 读取每个文件内容
    const migrations: MigrationFile[] = [];
    for (const file of migrationFiles) {
      const content = await gateway.getFileContent(session, repo.fullName, file.path, branch);

      if (content) {
        migrations.push({
          name: file.name,
          content,
        });
      }
    }

    return migrations.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err: any) {
    // 目录不存在或为空
    if (err.status === 404 || err.message?.includes('not found')) {
      return [];
    }
    throw err;
  }
}

export async function fetchMigrationFilesFromRepo(
  projectId: string,
  databaseType: string,
  branch: string = 'main'
): Promise<MigrationFile[]> {
  return fetchMigrationFilesFromRepoPath(projectId, `migrations/${databaseType}`, branch);
}
