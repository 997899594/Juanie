import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { redirectLegacyRuntimeRoute } from '../legacy-runtime-redirect';

export default async function RuntimeDiagnosticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ env?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!session?.user?.id) {
    redirect('/login');
  }

  redirectLegacyRuntimeRoute({
    projectId: id,
    environmentId: resolvedSearchParams?.env ?? null,
    section: 'diagnostics',
  });
}
