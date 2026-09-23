import { betterFetch } from "@better-fetch/fetch";
import { NextResponse, type NextRequest } from "next/server";

// /api/auth/get-session returns { session, user } — not just a Session record
type GetSessionResponse = {
  session: { id: string; expiresAt: string; userId: string };
  user: { id: string; email: string; name: string; role: string };
};

const protectedRoutes = ["/dashboard", "/portal"];

export async function middleware(request: NextRequest) {
  const pathName = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathName.startsWith(route)
  );

  if (isProtectedRoute) {
    const { data } = await betterFetch<GetSessionResponse>(
      "/api/auth/get-session",
      {
        baseURL: request.nextUrl.origin,
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      }
    );

    if (!data?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const userRole = data.user.role;

    // 1. Client restricted to portal only
    if (userRole === "client" && pathName.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }

    // 2. Internal staff cannot access portal
    if (userRole !== "client" && pathName.startsWith("/portal")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // 3. Supervisor restricted to monitor only
    if (userRole === "supervisor") {
      if (
        pathName === "/dashboard" ||
        (!pathName.startsWith("/dashboard/monitor") &&
          pathName.startsWith("/dashboard/"))
      ) {
        return NextResponse.redirect(
          new URL("/dashboard/monitor", request.url)
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|login).*)"],
};