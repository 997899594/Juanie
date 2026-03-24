'use client';

import { useParams } from 'next/navigation';
import { ReleasesPageClient } from '@/components/projects/ReleasesPageClient';

export default function ReleasesPage() {
  const params = useParams();
  const projectId = params.id as string;

  return <ReleasesPageClient projectId={projectId} />;
}
