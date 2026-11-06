'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HospitalCampsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/camps');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6 text-center">
      <div className="space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-rose-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Redirecting to Unified Camps Directory...</p>
      </div>
    </div>
  );
}
