import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import type { NextAuthConfig } from 'next-auth';
import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import GitLab from 'next-auth/providers/gitlab';
import { sanitizePersistedAuthAccount } from '@/lib/auth/account-sanitization';
import { FeishuProvider } from '@/lib/auth/feishu-provider';
import { getDb } from '@/lib/db';
import { type GitProviderType, users } from '@/lib/db/schema';
import { resolveGitLabProviderType, resolveGitLabServerUrlFromEnv } from '@/lib/git/gitlab-server';
import { upsertGrantFromOAuth } from '@/lib/integrations/service/grant-service';

const isDev = process.env.NODE_ENV === 'development';
const hasGitHubOAuth = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const hasGitLabOAuth = Boolean(process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET);
const hasFeishuOAuth = Boolean(process.env.FEISHU_CLIENT_ID && process.env.FEISHU_CLIENT_SECRET);

function isAllowedFeishuEmail(email?: string | null): boolean {
  const allowedDomains = (process.env.FEISHU_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (allowedDomains.length === 0) {
    return true;
  }

  const domain = email?.split('@')[1]?.toLowerCase();
  return Boolean(domain && allowedDomains.includes(domain));
}

function buildCredentialFreeAuthAdapter(): Adapter {
  const adapter = DrizzleAdapter(getDb());

  return {
    ...adapter,
    linkAccount(account) {
      if (!adapter.linkAccount) {
        throw new Error('Auth adapter does not support account linking');
      }

      return adapter.linkAccount(sanitizePersistedAuthAccount(account));
    },
  };
}

export const onOAuthGrantPersist = async ({
  userId,
  provider,
  accessToken,
  refreshToken,
  expiresAt,
  scope,
  serverUrl,
}: {
  userId: string;
  provider: GitProviderType;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
  serverUrl?: string | null;
}) => {
  return upsertGrantFromOAuth({
    userId,
    provider,
    accessToken,
    refreshToken,
    expiresAt: expiresAt ? new Date(expiresAt * 1000) : null,
    scopeRaw: scope,
    serverUrl,
  });
};

export const onAuthSignOut = async (userId: string) => {
  return { ok: true as const, userId };
};

function buildAuthConfig(): NextAuthConfig {
  const gitLabServerUrl = resolveGitLabServerUrlFromEnv();
  const gitLabProviderType = resolveGitLabProviderType(gitLabServerUrl);

  return {
    adapter: buildCredentialFreeAuthAdapter(),
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
              baseUrl: gitLabServerUrl,
              authorization: {
                params: {
                  scope: 'read_user read_repository api',
                },
              },
            }),
          ]
        : []),
      ...(hasFeishuOAuth
        ? [
            FeishuProvider({
              clientId: process.env.FEISHU_CLIENT_ID!,
              clientSecret: process.env.FEISHU_CLIENT_SECRET!,
            }),
          ]
        : []),
    ],
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider !== 'feishu') {
          return true;
        }

        return isAllowedFeishuEmail(user.email);
      },
      async jwt({ token, user, account }) {
        if (user) {
          token.id = user.id;
        }

        if (account) {
          token.provider = account.provider === 'gitlab' ? gitLabProviderType : account.provider;
        }

        if (
          user &&
          account?.access_token &&
          (account.provider === 'github' || account.provider === 'gitlab')
        ) {
          const provider = account.provider === 'gitlab' ? gitLabProviderType : account.provider;
          await onOAuthGrantPersist({
            userId: user.id!,
            provider,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
            scope: account.scope,
            serverUrl: provider === 'github' ? null : gitLabServerUrl,
          });
        }

        return token;
      },
      async session({ session, token }) {
        if (token?.id) {
          session.user.id = token.id as string;
        }

        if (token?.provider) {
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
      error: '/login/error',
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
