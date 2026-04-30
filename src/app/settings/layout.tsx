import { SettingsTabNav } from '@/components/settings/SettingsTabNav';
import { PageShell } from '@/components/ui/page-shell';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell size="content">
      <SettingsTabNav />
      {children}
    </PageShell>
  );
}
