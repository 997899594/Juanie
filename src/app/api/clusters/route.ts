import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clusters } from '@/lib/db/schema';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allClusters = await db.query.clusters.findMany();

  return NextResponse.json(allClusters);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, apiServer, kubeconfig, defaultNamespacePrefix, isDefault } = await request.json();

  if (!name || !apiServer || !kubeconfig) {
    return NextResponse.json(
      { error: 'Name, API server and kubeconfig are required' },
      { status: 400 }
    );
  }

  if (isDefault) {
    await db.update(clusters).set({ isDefault: false });
  }

  const [cluster] = await db
    .insert(clusters)
    .values({
      name,
      apiServer,
      kubeconfig,
      defaultNamespacePrefix: defaultNamespacePrefix || 'juanie',
      isDefault: isDefault || false,
    })
    .returning();

  return NextResponse.json(cluster, { status: 201 });
}
