import { and, eq, gt } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { auth, signIn } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamInvitations, teamMembers } from '@/lib/db/schema';
import { formatPlatformDateTime } from '@/lib/time/format';

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
      <div className="min-h-screen bg-background px-6 py-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
          <div className="ui-floating w-full max-w-md px-8 py-10 text-center">
            <h1 className="text-xl font-semibold">邀请无效</h1>
            <p className="mt-2 text-sm text-muted-foreground">这个邀请链接无效，或已过期。</p>
          </div>
        </div>
      </div>
    );
  }

  const callbackUrl = `/invite/${token}`;
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-background px-6 py-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
          <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="ui-floating px-8 py-10">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-lg font-semibold text-background">
                J
              </div>
              <div className="mt-6 text-2xl font-semibold tracking-tight">你被邀请加入团队</div>
              <div className="mt-2 text-sm text-muted-foreground">
                以 <strong>{invitation.role}</strong> 身份加入{' '}
                <strong>{invitation.team.name}</strong>。
              </div>

              <div className="mt-8 space-y-3">
                <form
                  action={async () => {
                    'use server';
                    await signIn('github', { redirectTo: callbackUrl });
                  }}
                >
                  <Button type="submit" variant="outline" className="h-11 w-full rounded-xl">
                    使用 GitHub 继续
                  </Button>
                </form>
                <form
                  action={async () => {
                    'use server';
                    await signIn('gitlab', { redirectTo: callbackUrl });
                  }}
                >
                  <Button type="submit" variant="outline" className="h-11 w-full rounded-xl">
                    使用 GitLab 继续
                  </Button>
                </form>
              </div>
            </div>

            <div className="hidden ui-floating px-8 py-10 lg:block">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                邀请
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">
                {invitation.team.name}
              </div>
              <div className="mt-6 grid gap-3">
                <div className="ui-control-muted px-5 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    角色
                  </div>
                  <div className="mt-3 text-sm font-semibold capitalize">{invitation.role}</div>
                </div>
                <div className="ui-control-muted px-5 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    过期时间
                  </div>
                  <div className="mt-3 text-sm font-semibold">
                    {formatPlatformDateTime(invitation.expires) ?? '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  redirect(`/teams/${invitation.teamId}`);
}
