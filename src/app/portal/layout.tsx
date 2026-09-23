import { auth, signOut } from "@/lib/auth";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold">
          Ereboost · Panel de afiliado — {session?.user?.name}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="text-sm text-neutral-400 hover:text-white" type="submit">
            Salir
          </button>
        </form>
      </header>
      <main className="p-6 max-w-3xl mx-auto">{children}</main>
    </div>
  );
}
