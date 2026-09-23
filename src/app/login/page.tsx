"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const initialTab = params.get("as") === "admin" ? "admin" : "afiliado";
  const [tab, setTab] = useState<"admin" | "afiliado">(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn(tab === "admin" ? "admin" : "affiliate", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }

    window.location.href = tab === "admin" ? "/admin" : "/portal";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-1 text-center">
          Ereboost Afiliados
        </h1>
        <p className="text-neutral-400 text-sm text-center mb-6">
          Dashboard de códigos de descuento
        </p>

        <div className="flex mb-6 rounded-lg bg-neutral-900 p-1">
          <button
            type="button"
            onClick={() => setTab("afiliado")}
            className={`flex-1 py-2 text-sm rounded-md transition ${
              tab === "afiliado"
                ? "bg-orange-600 text-white"
                : "text-neutral-400"
            }`}
          >
            Soy afiliado
          </button>
          <button
            type="button"
            onClick={() => setTab("admin")}
            className={`flex-1 py-2 text-sm rounded-md transition ${
              tab === "admin" ? "bg-orange-600 text-white" : "text-neutral-400"
            }`}
          >
            Admin
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-neutral-900 rounded-xl p-6 space-y-4 border border-neutral-800"
        >
          <div>
            <label className="block text-sm text-neutral-300 mb-1">Usuario</label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-600"
              placeholder="tu-usuario"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-300 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-600"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white rounded-md py-2 font-medium transition"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
