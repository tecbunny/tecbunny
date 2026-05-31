'use client';

import * as React from 'react';

import { AuthProvider } from './AuthProvider';

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
