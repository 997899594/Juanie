import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
    provider?: string;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    provider?: string;
  }
}
