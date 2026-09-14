import { projectPartnerResponse } from './partner-contract.policy';

type Operation = Parameters<typeof projectPartnerResponse>[1];

/** Core's global ResponseEnvelopeInterceptor wraps every non-Fineract success. */
export function projectCorePartnerResponse(value: unknown, operation: Operation): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Core envelope');
  const envelope = value as Record<string, unknown>;
  if (envelope.success !== true || !Object.prototype.hasOwnProperty.call(envelope, 'data') ||
    !envelope.meta || typeof envelope.meta !== 'object' || Array.isArray(envelope.meta)) {
    throw new Error('Invalid Core success envelope');
  }
  // Never forward tracing metadata or arbitrary envelope fields to the browser.
  // Inner projection still verifies schema version, partner pair and secret semantics.
  return projectPartnerResponse(envelope.data, operation);
}
