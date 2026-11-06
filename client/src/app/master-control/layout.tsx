'use client';

import React from 'react';
import { AdminSessionProvider, useAdminSession } from './AdminSessionContext';
import AdminTerminalGate from './AdminTerminalGate';

function AdminProtectedArea({ children }: { children: React.ReactNode }) {
  const { isAdminUnlocked } = useAdminSession();

  if (!isAdminUnlocked) {
    return <AdminTerminalGate />;
  }

  return <>{children}</>;
}

export default function MasterControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminProtectedArea>{children}</AdminProtectedArea>
    </AdminSessionProvider>
  );
}
