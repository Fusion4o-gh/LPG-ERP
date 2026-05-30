"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useRef } from "react";
import { resolveModule } from "@/lib/navigation/modules";

const EASE = [0.23, 1, 0.32, 1] as const;
const OFFSET = 24;
const STAGGER = 0.06;
const DURATION = 0.35;

function useModuleKey(pathname: string) {
  return useMemo(() => {
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      return "dashboard";
    }

    const resolved = resolveModule(pathname);
    return resolved?.module.id ?? pathname;
  }, [pathname]);
}

function collectAnimatableBlocks(container: HTMLElement): HTMLElement[] {
  const cards = Array.from(container.querySelectorAll<HTMLElement>(".card"));
  const sections = Array.from(container.querySelectorAll<HTMLElement>("section")).filter(
    (section) => !section.classList.contains("card") && !section.querySelector(".card"),
  );
  const headers = Array.from(container.querySelectorAll<HTMLElement>("header")).filter(
    (header) => !header.closest("[data-print-hidden]") && !header.closest("aside"),
  );
  const custom = Array.from(container.querySelectorAll<HTMLElement>("[data-module-block]"));

  const combined = [...headers, ...cards, ...sections, ...custom];
  return combined.filter(
    (element) => !combined.some((other) => other !== element && other.contains(element)),
  );
}

function StaggeredModuleContent({
  moduleKey,
  children,
}: {
  moduleKey: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || reducedMotion) return;

    const blocks = collectAnimatableBlocks(container).filter(
      (element) => !element.closest("[data-no-module-animate]"),
    );
    if (blocks.length === 0) return;

    const controls = blocks.map((element, index) => {
      const fromLeft = index % 2 === 0;
      element.style.willChange = "transform, opacity";
      return animate(
        element,
        { opacity: [0, 1], x: [fromLeft ? -OFFSET : OFFSET, 0] },
        { duration: DURATION, delay: index * STAGGER, ease: EASE },
      );
    });

    return () => {
      controls.forEach((control) => control.stop());
      blocks.forEach((element) => {
        element.style.willChange = "";
        element.style.opacity = "";
        element.style.transform = "";
      });
    };
  }, [moduleKey, reducedMotion]);

  return (
    <div ref={containerRef} className="module-transition-content">
      {children}
    </div>
  );
}

export function ModuleTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const moduleKey = useModuleKey(pathname);
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={moduleKey}
        className="module-transition-root"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reducedMotion ? undefined : { opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.12 }}
      >
        <StaggeredModuleContent moduleKey={moduleKey}>{children}</StaggeredModuleContent>
      </motion.div>
    </AnimatePresence>
  );
}
