import { redirect } from 'next/navigation';
import { UserSettingsClient } from '@/components/settings/UserSettingsClient';
import { auth } from '@/lib/auth';
import { getSettingsPageData } from '@/lib/settings/service';

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getSettingsPageData(session.user.id);

  if (!pageData) {
    redirect('/login');
  }

  return <UserSettingsClient initialData={pageData} />;
}
