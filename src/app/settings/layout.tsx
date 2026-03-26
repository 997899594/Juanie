import { SettingsTabNav } from '@/components/settings/SettingsTabNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SettingsTabNav />
      {children}
    </div>
  );
}
