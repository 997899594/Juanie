import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import GitLab from 'next-auth/providers/gitlab';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

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
    }),
    GitLab({
      clientId: process.env.GITLAB_CLIENT_ID!,
      clientSecret: process.env.GITLAB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
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
