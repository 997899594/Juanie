import { notFound, redirect } from 'next/navigation';
import { TeamSettingsClient } from '@/components/teams/TeamSettingsClient';
import { auth } from '@/lib/auth';
import { getTeamSettingsPageData } from '@/lib/teams/service';

export default async function TeamSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getTeamSettingsPageData(id, session.user.id);

  if (!pageData) {
    notFound();
  }

  return <TeamSettingsClient teamId={id} initialData={pageData} />;
}
