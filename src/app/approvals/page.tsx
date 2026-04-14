import { redirect } from 'next/navigation';

export default async function LegacyApprovalsPage() {
  redirect('/inbox');
}
