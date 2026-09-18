import { describe, expect, it } from 'bun:test';
import { validObservation } from '../scripts/deployed-console-check.cjs';
const origin = 'https://staging-console.mobicred.net';
const baseline = { origin, path: '/partners', status: 303, redirect: `${origin}/auth/login`, cacheControl: 'private, no-store', hasConsoleShell: false, hasTenantLogin: false };
describe('deployed observations cannot turn an outage into a passing check', () => {
  it('accepts the expected anonymous login boundary', () => expect(validObservation(baseline)).toBe(true));
  it('rejects failures, unexpected success, shell leaks and external redirects', () => {
    for (const patch of [{ status: 503 }, { status: 404 }, { status: 200 }, { hasConsoleShell: true }, { hasTenantLogin: true }, { error: 'ENOTFOUND' }, { truncated: true }, { cacheControl: 'public' }, { redirect: 'https://other.example/auth/login' }]) expect(validObservation({ ...baseline, ...patch })).toBe(false);
  });
  it('requires a working sign-in form and explicit API denial', () => {
    expect(validObservation({ ...baseline, path: '/auth/login', status: 200, hasSignInForm: true })).toBe(true);
    expect(validObservation({ ...baseline, path: '/auth/login', status: 200, hasSignInForm: false })).toBe(false);
    expect(validObservation({ ...baseline, path: '/api/partners', status: 401 })).toBe(true);
    expect(validObservation({ ...baseline, path: '/api/partners', status: 200 })).toBe(false);
  });
});
