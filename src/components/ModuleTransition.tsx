"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { resolveModule } from "@/lib/navigation/modules";

function useModuleKey(pathname: string) {
  return useMemo(() => {
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      return "dashboard";
    }

    const resolved = resolveModule(pathname);
    return resolved?.module.id ?? pathname;
  }, [pathname]);
}

/** Instant module content swap — no stagger or route flourish. */
export function ModuleTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const moduleKey = useModuleKey(pathname);

  return (
    <div key={moduleKey} className="module-transition-root">
      {children}
    </div>
  );
}
