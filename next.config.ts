import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // No bloquear el build por reglas de lint (tool interno, tipado con TypeScript
    // ya se valida por separado). Se puede correr `npm run lint` manualmente.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
