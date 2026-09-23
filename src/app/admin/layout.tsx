import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Ereboost · Admin</span>
          <nav className="flex gap-4 text-sm text-neutral-400">
            <Link href="/admin" className="hover:text-white">
              Resumen
            </Link>
            <Link href="/admin/afiliados" className="hover:text-white">
              Afiliados
            </Link>
            <Link href="/admin/meses" className="hover:text-white">
              Cierre de meses
            </Link>
            <Link href="/admin/simulacion" className="hover:text-white">
              Simulación histórica
            </Link>
            <Link href="/admin/configuracion" className="hover:text-white">
              Configuración
            </Link>
          </nav>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <span className="text-sm text-neutral-500 mr-3">
            {session?.user?.email}
          </span>
          <button className="text-sm text-neutral-400 hover:text-white" type="submit">
            Salir
          </button>
        </form>
      </header>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
