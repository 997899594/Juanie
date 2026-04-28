import { notFound, redirect } from 'next/navigation';
import { ReleasesPageClient } from '@/components/projects/ReleasesPageClient';
import {
  getProjectEnvironmentOrNull,
  getProjectWithRepositoryAccessOrNull,
} from '@/lib/api/page-access';
import { auth } from '@/lib/auth';
import { getProjectReleasesPageData } from '@/lib/releases/service';

export default async function EnvironmentDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; envId: string }>;
  searchParams?: Promise<{ risk?: string }>;
}) {
  const session = await auth();
  const { id, envId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const access = await getProjectWithRepositoryAccessOrNull(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  const environment = await getProjectEnvironmentOrNull(id, envId);
  if (!environment) {
    notFound();
  }

  const pageData = await getProjectReleasesPageData({
    project: access.project,
    role: access.member.role,
    envFilter: envId,
    riskFilter: resolvedSearchParams?.risk,
    fixedEnvFilter: true,
  });

  return <ReleasesPageClient projectId={id} initialData={pageData} />;
}
