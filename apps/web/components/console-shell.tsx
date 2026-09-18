'use client';
import type { ReactNode } from 'react';
import type { SectionId } from '../lib/console-model';
import { ConsoleFrame } from './console-frame';

/** Explicit preview-only frame. Authenticated routes use the persistent workspace layout. */
export function PreviewConsoleShell({ section, children }: { section: SectionId; children: ReactNode }) {
  return <ConsoleFrame section={section} preview>{children}</ConsoleFrame>;
}
