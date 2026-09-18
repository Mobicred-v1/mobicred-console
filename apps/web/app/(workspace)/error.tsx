'use client';
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="panel empty-state" role="alert"><h1>This view could not be loaded</h1><p>Your navigation remains available. Retry this view; no preview data was substituted.</p><button className="button primary" onClick={reset}>Retry this view</button></section>;
}
