import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "admin",
      name: "Admin",
      credentials: {
        email: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const admin = await prisma.adminUser.findUnique({ where: { email } });
        if (!admin) return null;

        const valid = await bcrypt.compare(password, admin.passwordHash);
        if (!valid) return null;

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name || "Admin",
          role: "ADMIN" as const,
        };
      },
    }),
    Credentials({
      id: "affiliate",
      name: "Afiliado",
      credentials: {
        email: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const affiliate = await prisma.affiliate.findUnique({ where: { email } });
        if (!affiliate || !affiliate.active) return null;

        const valid = await bcrypt.compare(password, affiliate.passwordHash);
        if (!valid) return null;

        return {
          id: affiliate.id,
          email: affiliate.email,
          name: affiliate.name,
          role: "AFFILIATE" as const,
        };
      },
    }),
  ],
});
