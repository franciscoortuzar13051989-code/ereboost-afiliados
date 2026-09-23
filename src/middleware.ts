import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Usa la config liviana (sin bcrypt ni Prisma) para que el middleware, que
// corre en el Edge Runtime, no se pase del límite de tamaño (1MB en Vercel
// Hobby). Solo necesita leer el rol desde el JWT, no verificar contraseñas.
const { auth } = NextAuth(authConfig);

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
