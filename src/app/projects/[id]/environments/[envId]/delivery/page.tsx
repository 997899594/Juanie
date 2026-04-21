import { notFound, redirect } from 'next/navigation';
import { ReleasesPageClient } from '@/components/projects/ReleasesPageClient';
import { auth } from '@/lib/auth';
import { getProjectEnvironmentOrNull, getProjectMemberRole } from '@/lib/environments/page-context';
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

  const access = await getProjectMemberRole(id, session.user.id);
  if (!access) {
    redirect('/projects');
  }

  const environment = await getProjectEnvironmentOrNull(id, envId);
  if (!environment) {
    notFound();
  }

  const pageData = await getProjectReleasesPageData({
    projectId: id,
    role: access.member.role,
    envFilter: envId,
    riskFilter: resolvedSearchParams?.risk,
  });

  return <ReleasesPageClient projectId={id} initialData={pageData} />;
}
