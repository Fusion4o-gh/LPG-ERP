"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="mt-3 flex w-full items-center gap-2 rounded-lg border border-[color:var(--sidebar-border)] bg-transparent px-3 py-2 text-sm font-semibold text-[color:var(--sidebar-text)] transition-colors hover:border-rose-300 hover:bg-rose-500/10 hover:text-rose-500"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5M21 12H9M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      </svg>
      Logout
    </button>
  );
}
