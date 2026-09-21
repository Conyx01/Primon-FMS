import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "better-auth/types";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ['/dashboard', '/portal'];

export async function middleware(request: NextRequest) {
  const pathName = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(route => pathName.startsWith(route));
  
  if (isProtectedRoute) {
    const { data: session } = await betterFetch<Session>(
      "/api/auth/get-session",
      {
        baseURL: request.nextUrl.origin,
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      },
    );
    
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|login).*)'],
};
