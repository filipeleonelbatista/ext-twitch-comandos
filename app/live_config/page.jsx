'use client';

import { Suspense } from 'react';
import { ConfigView } from '@/app/index/page';
import LoadingOverlay from '@/app/components/LoadingOverlay';

export default function LiveConfigPage() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <ConfigView />
    </Suspense>
  );
}
