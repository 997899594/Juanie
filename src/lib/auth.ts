import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import type { NextAuthConfig } from 'next-auth';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import GitLab from 'next-auth/providers/gitlab';
import { getDb } from '@/lib/db';
import { type GitProviderType, users } from '@/lib/db/schema';
import { revokeActiveGrants, upsertGrantFromOAuth } from '@/lib/integrations/service/grant-service';

const isDev = process.env.NODE_ENV === 'development';
const hasGitHubOAuth = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const hasGitLabOAuth = Boolean(process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET);

export const onOAuthGrantPersist = async ({
  userId,
  provider,
  accessToken,
  refreshToken,
  expiresAt,
  scope,
}: {
  userId: string;
  provider: GitProviderType;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
}) => {
  return upsertGrantFromOAuth({
    userId,
    provider,
    accessToken,
    refreshToken,
    expiresAt: expiresAt ? new Date(expiresAt * 1000) : null,
    scopeRaw: scope,
  });
};

export const onAuthSignOut = async (userId: string) => {
  return revokeActiveGrants(userId);
};

function buildAuthConfig(): NextAuthConfig {
  return {
    adapter: DrizzleAdapter(getDb()),
    session: {
      strategy: 'jwt',
    },
    providers: [
      ...(isDev
        ? [
            Credentials({
              name: 'Dev User',
              credentials: {},
              async authorize() {
                const devUser = await getOrCreateDevUser();
                return devUser
                  ? { id: devUser.id, email: devUser.email, name: devUser.name }
                  : null;
              },
            }),
          ]
        : []),
      ...(hasGitHubOAuth
        ? [
            GitHub({
              clientId: process.env.GITHUB_CLIENT_ID!,
              clientSecret: process.env.GITHUB_CLIENT_SECRET!,
              authorization: {
                params: {
                  scope: 'read:user user:email repo workflow read:packages',
                  prompt: 'consent',
                },
              },
            }),
          ]
        : []),
      ...(hasGitLabOAuth
        ? [
            GitLab({
              clientId: process.env.GITLAB_CLIENT_ID!,
              clientSecret: process.env.GITLAB_CLIENT_SECRET!,
              authorization: {
                params: {
                  scope: 'read_user read_repository api',
                },
              },
            }),
          ]
        : []),
    ],
    callbacks: {
      async jwt({ token, user, account }) {
        if (user) {
          token.id = user.id;
        }

        if (account) {
          token.accessToken = account.access_token;
          token.provider = account.provider;
        }

        if (
          user &&
          account?.access_token &&
          (account.provider === 'github' || account.provider === 'gitlab')
        ) {
          await onOAuthGrantPersist({
            userId: user.id!,
            provider: account.provider,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
            scope: account.scope,
          });
        }

        return token;
      },
      async session({ session, token }) {
        if (token?.id) {
          session.user.id = token.id as string;
        }

        if (token?.accessToken) {
          session.accessToken = token.accessToken as string;
          session.provider = token.provider as string;
        }

        return session;
      },
    },
    events: {
      async signOut(message) {
        if ('token' in message && message.token?.id) {
          await onAuthSignOut(message.token.id as string);
        }
      },
    },
    pages: {
      signIn: '/login',
    },
  };
}

const nextAuth = NextAuth(buildAuthConfig);

export const { handlers, signIn, signOut } = nextAuth;
export const auth = nextAuth.auth;

async function getOrCreateDevUser() {
  const devUserId = '00000000-0000-0000-0000-000000000001';
  const db = getDb();

  let devUser = await db.query.users.findFirst({
    where: eq(users.id, devUserId),
  });

  if (!devUser) {
    await db.insert(users).values({
      id: devUserId,
      name: 'Dev User',
      email: 'dev@localhost',
    });
    devUser = await db.query.users.findFirst({
      where: eq(users.id, devUserId),
    });
  }

  return devUser;
}

export { getOrCreateDevUser };
