/** Public error categories only. Never surface arbitrary owner error bodies or tokens. */
export const errorCodes = ['ACCESS_NOT_CONFIGURED', 'ACCESS_DENIED', 'RECORD_NOT_FOUND'] as const;
export type ApiErrorCode = (typeof errorCodes)[number];
export class ApiFailure extends Error {
  constructor(readonly status: number, readonly code?: ApiErrorCode) { super('Console request could not be completed'); }
}
export function publicErrorCode(value: unknown): ApiErrorCode | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const code = (value as Record<string, unknown>).code;
  return errorCodes.find((known) => known === code);
}
