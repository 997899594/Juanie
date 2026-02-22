'use server';

import { signIn } from '@/lib/auth';

export async function devSignIn() {
  await signIn('credentials', { redirectTo: '/' });
}
