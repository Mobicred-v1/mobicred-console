'use client';
import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return <span className={`navigation-indicator ${pending ? 'pending' : ''}`} data-navigation-pending={pending ? 'true' : undefined} aria-hidden="true" />;
}
/** Next owns history and navigation. The pending hint never unmounts the surrounding frame. */
export function WorkspaceLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<PendingIndicator /></Link>;
}
