import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import GitLab from 'next-auth/providers/gitlab';
import { db } from '@/lib/db';
import { gitProviders, users } from '@/lib/db/schema';

const isDev = process.env.NODE_ENV === 'development';

const nextAuth = NextAuth({
  adapter: DrizzleAdapter(db),
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
              return devUser ? { id: devUser.id, email: devUser.email, name: devUser.name } : null;
            },
          }),
        ]
      : []),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
    GitLab({
      clientId: process.env.GITLAB_CLIENT_ID!,
      clientSecret: process.env.GITLAB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read_user read_repository api',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      // 保存 access token 到 JWT
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      // 传递 access token 到 session
      if (token?.accessToken) {
        session.accessToken = token.accessToken as string;
        session.provider = token.provider as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      // 登录成功后自动创建/更新 gitProvider
      if (account && user.id) {
        const providerType = account.provider as 'github' | 'gitlab';

        // 检查是否已存在
        const existing = await db.query.gitProviders.findFirst({
          where: eq(gitProviders.userId, user.id),
        });

        if (!existing && account.access_token) {
          // 创建新的 git provider 记录
          await db.insert(gitProviders).values({
            userId: user.id,
            type: providerType,
            name: providerType === 'github' ? 'GitHub' : 'GitLab',
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
            username: user.name,
            avatarUrl: user.image,
          });
        } else if (existing && account.access_token) {
          // 更新现有记录的 token
          await db
            .update(gitProviders)
            .set({
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
              updatedAt: new Date(),
            })
            .where(eq(gitProviders.userId, user.id));
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/login',
  },
});

export const { handlers, signIn, signOut } = nextAuth;
export const auth = nextAuth.auth;

async function getOrCreateDevUser() {
  const devUserId = '00000000-0000-0000-0000-000000000001';

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
