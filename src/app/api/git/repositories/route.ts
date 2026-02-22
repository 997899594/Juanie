import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { gitProviders, repositories } from '@/lib/db/schema';
import { createGitProvider } from '@/lib/git';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId');
  const search = searchParams.get('search');

  if (!providerId) {
    return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
  }

  const provider = await db.query.gitProviders.findFirst({
    where: eq(gitProviders.id, providerId),
  });

  if (!provider || !provider.accessToken) {
    return NextResponse.json(
      { error: 'Git provider not found or not authorized' },
      { status: 404 }
    );
  }

  if (provider.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const gitProvider = createGitProvider({
      type: provider.type,
      serverUrl: provider.serverUrl || undefined,
      clientId: provider.clientId || '',
      clientSecret: provider.clientSecret || '',
      redirectUri: '',
    });

    const gitRepos = await gitProvider.getRepositories(provider.accessToken, {
      search: search || undefined,
      perPage: 100,
    });

    const result = [];

    for (const repo of gitRepos) {
      const existing = await db.query.repositories.findFirst({
        where: eq(repositories.externalId, repo.id),
      });

      if (existing) {
        await db
          .update(repositories)
          .set({
            fullName: repo.fullName,
            name: repo.name,
            owner: repo.owner,
            cloneUrl: repo.cloneUrl,
            sshUrl: repo.sshUrl,
            webUrl: repo.webUrl,
            defaultBranch: repo.defaultBranch,
            isPrivate: repo.isPrivate,
            lastSyncAt: new Date(),
          })
          .where(eq(repositories.id, existing.id));
        result.push(existing);
      } else {
        const [created] = await db
          .insert(repositories)
          .values({
            providerId: provider.id,
            externalId: repo.id,
            fullName: repo.fullName,
            name: repo.name,
            owner: repo.owner,
            cloneUrl: repo.cloneUrl,
            sshUrl: repo.sshUrl,
            webUrl: repo.webUrl,
            defaultBranch: repo.defaultBranch,
            isPrivate: repo.isPrivate,
          })
          .returning();
        result.push(created);
      }
    }

    let filteredRepos = result;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredRepos = result.filter(
        (repo) =>
          repo.fullName.toLowerCase().includes(searchLower) ||
          repo.name.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json(
      filteredRepos.map((repo) => ({
        id: repo.id,
        fullName: repo.fullName,
        name: repo.name,
        defaultBranch: repo.defaultBranch || 'main',
      }))
    );
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}
