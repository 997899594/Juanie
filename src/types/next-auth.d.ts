import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
    accessToken?: string;
    provider?: string;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    accessToken?: string;
    provider?: string;
  }
}
