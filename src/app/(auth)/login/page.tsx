import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md">
        <div className="mb-6 rounded-md border border-slate-200 bg-white p-6 text-center shadow-sm">
          <img src="/fusion4o-logo.png" alt="Fusion4o" className="mx-auto h-20 w-auto" />
          <h1 className="mt-5 text-3xl font-semibold text-slate-950">LPG ERP</h1>
          <p className="mt-2 text-sm text-slate-600">Operational control for LPG distribution businesses</p>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full fusion-gradient" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Powered by Fusion4o</p>
          <p className="mt-1 text-xs text-slate-500">Custom Software & Intelligent Business Systems</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
