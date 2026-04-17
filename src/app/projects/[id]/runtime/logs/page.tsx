import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { redirectLegacyRuntimeRoute } from '../legacy-runtime-redirect';

export default async function RuntimeLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ env?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const { env } = await searchParams;

  if (!session?.user?.id) {
    redirect('/login');
  }

  redirectLegacyRuntimeRoute({
    projectId: id,
    environmentId: env ?? null,
    section: 'logs',
  });
}
