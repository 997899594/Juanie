import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { getTeamLayoutData } from '@/lib/teams/service';
import { TeamTabNav } from './team-tab-nav';

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { id } = await params;
  const pageData = await getTeamLayoutData(id, session.user.id);
  if (!pageData) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title={pageData.layout.title} description={pageData.layout.description} />
      <TeamTabNav teamId={id} />
      {children}
    </div>
  );
}
