import { trustedUrl } from './auth-policy';

/** A deployment-only exception for the single internal Compose service, never request input. */
export function consoleApiOrigin(env: Record<string, string | undefined> = process.env): string {
  if (env.CONSOLE_API_TRANSPORT === 'compose' && env.CONSOLE_API_URL === 'http://api:3005') return 'http://api:3005';
  return trustedUrl(env.CONSOLE_API_URL, env.CONSOLE_ENV === 'development', true).origin;
}
