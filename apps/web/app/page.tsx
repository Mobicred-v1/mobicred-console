type CaseRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  severity: string;
  customerRef?: string;
};

async function loadInbox(): Promise<
  | { state: 'live'; items: CaseRow[] }
  | { state: 'unauthorized' }
  | { state: 'unavailable'; detail: string }
> {
  try {
    const response = await fetch(
      `${process.env.CONSOLE_API_URL ?? 'http://localhost:3005'}/api/v1/investigation-cases?limit=20`,
      { cache: 'no-store' },
    );
    if (response.status === 401 || response.status === 403) {
      return { state: 'unauthorized' };
    }
    if (!response.ok) {
      return { state: 'unavailable', detail: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { items?: CaseRow[] };
    return { state: 'live', items: body.items ?? [] };
  } catch (error) {
    return {
      state: 'unavailable',
      detail: error instanceof Error ? error.message : 'network',
    };
  }
}

export default async function InboxPage() {
  const inbox = await loadInbox();

  return (
    <main>
      <h1>Investigation inbox</h1>
      <p className="lede">
        One case, several owners. Core, the payment gateway, and Credit
        Intelligence may disagree. This console does not invent a single status.
      </p>
      {inbox.state === 'unauthorized' ? (
        <p className="empty">
          Staff session required. Sign in through Keycloak. Do not paste
          internal API keys here.
        </p>
      ) : null}
      {inbox.state === 'unavailable' ? (
        <p className="empty">
          Inbox unavailable ({inbox.detail}). No demo cases are substituted.
        </p>
      ) : null}
      {inbox.state === 'live' && inbox.items.length === 0 ? (
        <p className="empty">No open cases in this tenant.</p>
      ) : null}
      {inbox.state === 'live'
        ? inbox.items.map((item) => (
            <article className="case" key={item.id}>
              <strong>{item.title}</strong>
              <div>
                {item.kind} · {item.status} · {item.severity}
                {item.customerRef ? ` · ${item.customerRef}` : ''}
              </div>
              <div className="owners">
                <span className="chip">core</span>
                <span className="chip">payment-gateway</span>
                <span className="chip">credit-intelligence</span>
              </div>
            </article>
          ))
        : null}
    </main>
  );
}
