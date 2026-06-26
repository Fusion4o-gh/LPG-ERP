import { LoginForm } from "@/components/LoginForm";

const FUSION4O_URL = "https://fusion4o.com";

function Fusion4oLogoLink({ className }: { className: string }) {
  return (
    <a
      href={FUSION4O_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-sm transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      aria-label="fusion4o.com"
    >
      <img src="/fusion4o-logo.png" alt="fusion4o" className={className} />
    </a>
  );
}

function Fusion4oSiteLink({ className }: { className?: string }) {
  return (
    <a
      href={FUSION4O_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-medium transition-colors hover:underline ${className ?? ""}`}
    >
      fusion4o.com
    </a>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-[38%] flex-col items-center justify-center p-12 relative"
        style={{ background: 'linear-gradient(180deg, #0C2845 0%, #123A5A 40%, #0F3150 100%)' }}
      >
        <div className="relative z-10 text-center max-w-xs">
          <Fusion4oLogoLink className="mx-auto mb-8 h-20 w-auto max-w-[180px] object-contain" />
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>LPG Management System</h1>
          <div className="mx-auto mb-5 h-0.5 w-12 rounded-full" style={{ background: 'linear-gradient(90deg, #F28C28, #D97823)' }} />
          <p className="text-flame-200 text-sm leading-relaxed">
            Operational control for LPG distribution businesses
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12" style={{ background: 'var(--skeu-surface)' }}>
        <div className="w-full max-w-sm">
          <LoginForm />
          <p className="mt-8 text-center text-xs text-steel-400">
            &copy; {new Date().getFullYear()} LPG Management System &middot;{" "}
            <Fusion4oSiteLink className="text-steel-500 hover:text-gas-700" />
          </p>
        </div>
      </div>
    </main>
  );
}
