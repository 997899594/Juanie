import { notFound, redirect } from 'next/navigation';
import { TeamOverviewClient } from '@/components/teams/TeamOverviewClient';
import { auth } from '@/lib/auth';
import { getTeamOverviewPageData } from '@/lib/teams/service';

export default async function TeamOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getTeamOverviewPageData(id, session.user.id);

  if (!pageData) {
    notFound();
  }

  return <TeamOverviewClient teamId={id} initialData={pageData} />;
}
