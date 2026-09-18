import { ApiFailure } from './api-failure';
import type { SourceState } from './console-model';
export function sourceFailure(error: unknown, recordRequest = false): { state: SourceState; detail: string } {
  if (error instanceof ApiFailure) {
    if (error.status === 401) return { state: 'unauthorized', detail: 'Your staff session must be verified again.' };
    if (error.status === 403) return { state: 'forbidden', detail: 'You are signed in. Your role does not permit this view. Contact your access administrator.' };
    if (error.code === 'ACCESS_NOT_CONFIGURED') return { state: 'not-configured', detail: 'You are signed in. Access to this capability has not been configured. An administrator must enable the appropriate read-role settings.' };
    if (error.status === 404 && recordRequest) return { state: 'not-found', detail: 'This record does not exist or is outside the selected operational scope.' };
  }
  return { state: 'unavailable', detail: 'This data source could not be loaded. Your staff session is separate from source availability. No sample data has been substituted.' };
}
