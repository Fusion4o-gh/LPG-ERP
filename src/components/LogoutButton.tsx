"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useLanguage();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-semibold text-steel-300 hover:bg-red-500/15 hover:text-red-300"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5M21 12H9M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      </svg>
      {t("Logout")}
    </button>
  );
}
