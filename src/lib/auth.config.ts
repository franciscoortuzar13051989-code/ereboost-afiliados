// Configuración "liviana" de NextAuth, sin providers (sin bcrypt ni Prisma),
// para poder usarla en el middleware (Edge Runtime), que tiene un límite de
// tamaño de paquete (1MB en el plan Hobby de Vercel). El middleware solo
// necesita leer el JWT de la sesión, no verificar contraseñas.
// La configuración completa (con los providers de login) vive en auth.ts.
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
};
