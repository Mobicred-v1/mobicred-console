import type { ReactNode } from 'react';
import { requirePageSession } from '../../lib/server-auth';
import { PersistentWorkspace } from '../../components/persistent-workspace';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { session } = await requirePageSession();
  return <PersistentWorkspace initialSession={session}>{children}</PersistentWorkspace>;
}
