import { notFound, redirect } from 'next/navigation';
import { TeamMembersClient } from '@/components/teams/TeamMembersClient';
import { auth } from '@/lib/auth';
import { getTeamMembersPageData } from '@/lib/teams/service';

export default async function TeamMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getTeamMembersPageData(id, session.user.id);

  if (!pageData) {
    notFound();
  }

  return <TeamMembersClient teamId={id} initialData={pageData} />;
}
