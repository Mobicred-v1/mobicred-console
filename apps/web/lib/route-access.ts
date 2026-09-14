export function routeAccess(path: string, method: string, preview: boolean): 'public' | 'protected' | 'not-found' {
  if (path.startsWith('/_next/static/')) return 'public';
  if (path === '/favicon.ico') return 'public';
  if (path === '/preview' || path.startsWith('/preview/')) return preview ? 'public' : 'not-found';
  const publicMethods: Record<string, string[]> = {
    '/auth/login': ['GET', 'HEAD'], '/auth/start': ['POST'], '/auth/callback': ['GET'], '/auth/logout': ['POST'], '/health': ['GET', 'HEAD'],
  };
  return publicMethods[path]?.includes(method) ? 'public' : 'protected';
}
