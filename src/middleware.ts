import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const role = (req.auth?.user as any)?.role as string | undefined;

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isPortalRoute = nextUrl.pathname.startsWith("/portal");

  if (isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login?as=admin", nextUrl));
  }

  if (isPortalRoute && role !== "AFFILIATE") {
    return NextResponse.redirect(new URL("/login?as=afiliado", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
