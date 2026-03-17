import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
        <p className="text-sm text-muted-foreground">@{team.slug}</p>
      </div>
      <TeamTabNav teamId={id} />
      {children}
    </div>
  );
}
