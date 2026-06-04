'use client';

import type { ReactNode } from 'react';

import SalesLayoutClient from './SalesLayoutClient';

export default function SalesLayout({ children }: { children: ReactNode }) {
  return <SalesLayoutClient>{children}</SalesLayoutClient>;
}
