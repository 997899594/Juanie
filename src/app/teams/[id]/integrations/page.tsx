import { notFound, redirect } from 'next/navigation';
import { TeamIntegrationsClient } from '@/components/teams/TeamIntegrationsClient';
import { auth } from '@/lib/auth';
import { getTeamIntegrationsPageData } from '@/lib/teams/service';

export default async function TeamIntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getTeamIntegrationsPageData(id, session.user.id);
  if (!pageData) {
    notFound();
  }

  return <TeamIntegrationsClient teamId={id} initialData={pageData} />;
}
