import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const protectedPaths = [
  "/dashboard",
  "/analytics",
  "/packages",
  "/subscriptions",
  "/vouchers",
  "/vendors",
  "/hotspots",
  "/portal-builder",
  "/devices",
  "/router",
  "/sessions",
  "/payments",
  "/revenue",
  "/reports",
  "/notifications",
  "/settings",
];

function isProtected(pathname: string) {
  return protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    if (isProtected(pathname)) {
      return redirectToLogin(request, pathname);
    }
    return NextResponse.next();
  }

  const { response, userId } = await updateSupabaseSession(request);

  if (isProtected(pathname) && !userId) {
    return redirectToLogin(request, pathname);
  }

  if (userId && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/analytics/:path*",
    "/packages/:path*",
    "/subscriptions/:path*",
    "/vouchers/:path*",
    "/vendors/:path*",
    "/hotspots/:path*",
    "/portal-builder/:path*",
    "/devices/:path*",
    "/router/:path*",
    "/sessions/:path*",
    "/payments/:path*",
    "/revenue/:path*",
    "/reports/:path*",
    "/notifications/:path*",
    "/settings/:path*",
  ],
};
