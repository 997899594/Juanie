import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { requireProjectRepositoryContext } from '@/lib/projects/context';

interface MigrationFile {
  name: string;
  content: string;
}

async function getProjectRepositoryContext(projectId: string) {
  const { project, repository } = await requireProjectRepositoryContext(projectId, {
    projectNotFound: 'Project not found',
    repositoryMissing: 'Project has no repository',
  });

  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: ['read_repo'],
  });

  if (!session) {
    throw new Error('No Git integration found');
  }

  return {
    session,
    repoFullName: repository.fullName,
  };
}

export async function listRepositoryDirectoryFromRepoPath(
  projectId: string,
  path: string,
  ref: string = 'main'
): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
  const context = await getProjectRepositoryContext(projectId);

  try {
    return await gateway.listDirectory(context.session, context.repoFullName, path, ref);
  } catch (err: any) {
    if (err.status === 404 || err.message?.includes('not found')) {
      return [];
    }
    throw err;
  }
}

export async function readRepositoryFileFromRepoPath(
  projectId: string,
  path: string,
  ref: string = 'main'
): Promise<string | null> {
  const context = await getProjectRepositoryContext(projectId);
  return gateway.getFileContent(context.session, context.repoFullName, path, ref);
}

export async function fetchMigrationFilesFromRepoPath(
  projectId: string,
  path: string,
  ref: string = 'main'
): Promise<MigrationFile[]> {
  const context = await getProjectRepositoryContext(projectId);

  try {
    const contents = await gateway.listDirectory(context.session, context.repoFullName, path, ref);

    const migrationFiles = contents.filter(
      (item) => item.type === 'file' && (item.name.endsWith('.sql') || item.name.endsWith('.js'))
    );

    const migrations: MigrationFile[] = [];
    for (const file of migrationFiles) {
      const content = await gateway.getFileContent(
        context.session,
        context.repoFullName,
        file.path,
        ref
      );

      if (content) {
        migrations.push({
          name: file.name,
          content,
        });
      }
    }

    return migrations.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err: any) {
    if (err.status === 404 || err.message?.includes('not found')) {
      return [];
    }
    throw err;
  }
}

export async function fetchMigrationFilesFromRepo(
  projectId: string,
  databaseType: string,
  ref: string = 'main'
): Promise<MigrationFile[]> {
  return fetchMigrationFilesFromRepoPath(projectId, `migrations/${databaseType}`, ref);
}
