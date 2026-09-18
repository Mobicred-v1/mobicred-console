'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isSection } from '../lib/console-model';
import type { StaffSession } from '../lib/session-model';
import { ConsoleFrame } from './console-frame';
import { StaffSessionProvider, useStaffWorkspace } from './staff-session-provider';
import './workspace-navigation.css';

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const value = pathname.split('/')[1] ?? 'overview';
  const section = isSection(value) ? value : 'overview';
  const { session } = useStaffWorkspace();
  return <ConsoleFrame section={section} preview={false} session={session}>{children}</ConsoleFrame>;
}
export function PersistentWorkspace({ initialSession, children }: { initialSession: StaffSession; children: ReactNode }) {
  return <StaffSessionProvider initialSession={initialSession}><Frame>{children}</Frame></StaffSessionProvider>;
}
