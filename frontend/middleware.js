import { next } from '@vercel/functions';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export const config = {
  matcher: ['/api/:path*', '/admin', '/admin/:path*', '/static/:path*'],
};

export default function middleware(request) {
  const url = new URL(request.url);

  if (LOCAL_HOSTS.has(url.hostname) || !process.env.PROXY_ACCESS_SECRET) {
    return next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-proxy-access-secret', process.env.PROXY_ACCESS_SECRET);

  return next({
    request: {
      headers: requestHeaders,
    },
  });
}
