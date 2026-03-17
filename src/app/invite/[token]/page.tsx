import { and, eq, gt } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamInvitations, teamMembers } from '@/lib/db/schema';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  const invitation = await db.query.teamInvitations.findFirst({
    where: and(eq(teamInvitations.token, token), gt(teamInvitations.expires, new Date())),
    with: { team: true },
  });

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Invalid invitation</h1>
          <p className="text-sm text-muted-foreground">
            This invitation link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    const callbackUrl = `/invite/${token}`;
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white text-lg font-bold mx-auto">
              J
            </div>
            <h1 className="text-xl font-semibold">You&apos;re invited</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to join <strong>{invitation.team.name}</strong> as{' '}
              <strong>{invitation.role}</strong>.
            </p>
          </div>
          <form
            action={async () => {
              'use server';
              await signIn('github', { redirectTo: callbackUrl });
            }}
          >
            <button
              type="submit"
              className="w-full h-10 flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Continue with GitHub
            </button>
          </form>
          <form
            action={async () => {
              'use server';
              await signIn('gitlab', { redirectTo: callbackUrl });
            }}
          >
            <button
              type="submit"
              className="w-full h-10 flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Continue with GitLab
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Check if already a member
  const existingMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, invitation.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!existingMember) {
    await db.insert(teamMembers).values({
      teamId: invitation.teamId,
      userId: session.user.id,
      role: invitation.role,
    });
  }

  // Keep invitation alive so others can use the same link
  redirect(`/teams/${invitation.teamId}`);
}
