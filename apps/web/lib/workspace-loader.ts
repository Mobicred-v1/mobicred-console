import type { ConsoleData, ConsoleSession, SectionId } from './console-model';
// Replaced by the authenticated server adapter in the following PR.
// Never issue anonymous requests and mistake a transport success for authorized data.
export async function loadWorkspace(_section: SectionId): Promise<{ data: ConsoleData; session?: ConsoleSession }> {
  return { data: { state: 'unauthorized', items: [], detail: 'Sign in through the staff identity provider. Upstream adapters remain fail-closed until their authorized contracts are connected.' } };
}
