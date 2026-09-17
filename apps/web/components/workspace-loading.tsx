export function WorkspaceLoading({ label = 'Loading this view…' }: { label?: string }) {
  return <section className="workspace-loading" aria-busy="true" aria-label={label}>
    <p role="status"><span className="loading-dot" />{label}</p>
    <div className="skeleton-line wide" /><div className="skeleton-line" />
    <div className="skeleton-panel" />
  </section>;
}
