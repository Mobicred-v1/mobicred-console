import { expect, test } from 'bun:test';
import { consoleApiOrigin } from '../apps/web/lib/api-origin';
import { trustedUrl } from '../apps/web/lib/auth-policy';

test('production Compose accepts only the fixed explicitly selected internal service', () => {
  expect(consoleApiOrigin({ CONSOLE_ENV: 'production', CONSOLE_API_TRANSPORT: 'compose', CONSOLE_API_URL: 'http://api:3005' })).toBe('http://api:3005');
});
test('the internal exception is not a general HTTP, proxy or credential exception', () => {
  for (const value of ['http://api:3005/path', 'http://api:3005?x=y', 'http://api:3005#x', 'http://other:3005', 'http://api:3005@evil.example', 'http://127.0.0.1:3005']) {
    expect(() => consoleApiOrigin({ CONSOLE_ENV: 'production', CONSOLE_API_TRANSPORT: 'compose', CONSOLE_API_URL: value })).toThrow();
  }
  expect(() => consoleApiOrigin({ CONSOLE_ENV: 'production', CONSOLE_API_URL: 'http://api:3005' })).toThrow();
});
test('existing HTTPS and loopback development integrations still work', () => {
  expect(consoleApiOrigin({ CONSOLE_API_URL: 'https://api.example.test' })).toBe('https://api.example.test');
  expect(consoleApiOrigin({ CONSOLE_ENV: 'development', CONSOLE_API_URL: 'http://127.0.0.1:3005' })).toBe('http://127.0.0.1:3005');
});
test('the login and public URL policies do not inherit the Compose HTTP exception', () => {
  expect(() => trustedUrl('http://api:3005', false)).toThrow();
  expect(() => trustedUrl('http://identity.example.test', false)).toThrow();
});
