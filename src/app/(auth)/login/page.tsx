import { LoginForm } from "@/components/LoginForm";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute right-4 top-4 z-20">
        <LanguageToggle />
      </div>

      {/* Background image layer */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/lpg-bg.png')",
          filter: "blur(4px)",
          transform: "scale(1.05)", /* prevent blur edge bleed */
          opacity: 0.5,
        }}
        aria-hidden="true"
      />

      {/* Dark scrim so card reads cleanly */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(10, 25, 45, 0.45)" }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <LoginForm />

        <p className="mt-6 text-center text-xs text-white/40">
          &copy; {new Date().getFullYear()} LPG Management System
        </p>
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 text-xs text-white/40">
        <img src="/fusion4o-logo.png" alt="" className="h-4 w-4 object-contain opacity-70" aria-hidden />
        <span>Powered by fusion4o</span>
      </div>
    </main>
  );
}
