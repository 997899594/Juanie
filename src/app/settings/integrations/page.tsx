import { redirect } from 'next/navigation';
import { IntegrationsControlPlaneClient } from '@/components/settings/IntegrationsControlPlaneClient';
import { auth } from '@/lib/auth';
import { getIntegrationsControlPlanePageData } from '@/lib/settings/integrations-service';

export default async function SettingsIntegrationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const pageData = await getIntegrationsControlPlanePageData(session.user.id);

  return <IntegrationsControlPlaneClient initialData={pageData} />;
}
