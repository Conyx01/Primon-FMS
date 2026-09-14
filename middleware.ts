import { auth } from '@/lib/auth/server';

export default auth.middleware({
  loginUrl: '/login',
});

export const config = {
  matcher: [
    // Protected routes requiring authentication
    '/dashboard/:path*',
    '/portal/:path*',
    // Do not run the middleware for static resources and public API routes
    '/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/intake|api/verify).*)',
  ],
};
