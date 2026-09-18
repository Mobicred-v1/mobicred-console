'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffSession } from '../lib/session-model';
import { isCurrentView, sessionRevision } from '../lib/session-revision';
import { useStaffWorkspace } from './staff-session-provider';
import { WorkspaceLoading } from './workspace-loading';

/** A stale history/cache entry may not expose another partner's previous content. */
export function StaffView({ snapshot, children }: { snapshot: StaffSession; children: ReactNode }) {
  const { session, changingContext, verify } = useStaffWorkspace();
  const router = useRouter();
  const signature = sessionRevision(snapshot);
  const currentSignature = sessionRevision(session);
  const attempted = useRef('');
  const fresh = isCurrentView(snapshot, session);
  useEffect(() => {
    if (fresh || changingContext) return;
    const key = signature + currentSignature;
    if (attempted.current === key) return;
    attempted.current = key;
    void verify().then((verified) => { if (verified) router.refresh(); });
  }, [fresh, changingContext, signature, currentSignature, verify, router]);
  if (changingContext || !fresh) return <WorkspaceLoading label="Updating operational scope…" />;
  return <div data-staff-view="true" key={currentSignature}>{children}</div>;
}
