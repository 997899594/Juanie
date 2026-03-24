import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, teams } from '@/lib/db/schema';
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

  const team = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!team) notFound();

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, session.user.id)),
  });
  if (!member) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title={team.name} description={`@${team.slug}`} />
      <TeamTabNav teamId={id} />
      {children}
    </div>
  );
}
