import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* ── Brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: "var(--sidebar-bg)" }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
            style={{ background: "var(--fusion-gradient)" }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-10"
            style={{ background: "var(--fusion-gradient)" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-5"
            style={{ background: "var(--fusion-gradient)" }}
          />
        </div>

        <div className="relative z-10 text-center max-w-sm">
          <img src="/fusion4o-logo.png" alt="Fusion4o" className="mx-auto mb-8 h-24 w-24 object-contain" />

          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">LPG ERP</h1>

          <div className="mx-auto mb-6 h-1 w-16 rounded-full fusion-gradient" />

          <p className="text-slate-300 text-base leading-relaxed">
            Operational control for LPG distribution businesses
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {[
              { icon: "⚡", label: "Real-time stock tracking" },
              { icon: "📊", label: "Sales & purchase reports" },
              { icon: "💳", label: "Payment & receipt management" },
              { icon: "🔒", label: "Role-based access control" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="text-lg">{f.icon}</span>
                <span className="text-sm text-slate-300 leading-snug">{f.label}</span>
              </div>
            ))}
          </div>

          <p className="mt-10 text-xs text-slate-500 uppercase tracking-widest">Powered by Fusion4o</p>
          <p className="mt-1 text-xs text-slate-600">Custom Software & Intelligent Business Systems</p>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <img src="/fusion4o-logo.png" alt="Fusion4o" className="h-16 w-16 object-contain mb-3" />
          <h1 className="text-2xl font-bold text-slate-900">LPG ERP</h1>
          <p className="mt-1 text-sm text-slate-500">Powered by Fusion4o</p>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 lg:block hidden">
            <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-2 text-slate-500">Sign in to your account to continue</p>
          </div>
          <div className="lg:hidden mb-2">
            <h2 className="text-xl font-bold text-slate-900 text-center">Sign in</h2>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Fusion4o. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
