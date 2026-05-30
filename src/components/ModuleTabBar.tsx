"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import {
  filterModules,
  rememberModuleTab,
  resolveModule,
  type NavTab,
  type NavTabGroup,
} from "@/lib/navigation/modules";

function TabRow({
  tabs,
  pathname,
  moduleId,
  variant = "secondary",
}: {
  tabs: NavTab[];
  pathname: string;
  moduleId: string;
  variant?: "primary" | "secondary";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector('[data-active="true"]');
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [pathname]);

  if (tabs.length === 0) return null;

  const base =
    variant === "primary"
      ? "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
      : "whitespace-nowrap rounded-md px-3 py-1 text-[13px] transition-colors";

  return (
    <div ref={scrollRef} className="flex gap-1 overflow-x-auto scroll-smooth pb-0.5 [scrollbar-width:thin]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-active={isActive ? "true" : "false"}
            aria-current={isActive ? "page" : undefined}
            onClick={() => rememberModuleTab(moduleId, tab.href)}
            style={isActive ? { background: "var(--fusion-gradient)" } : undefined}
            className={`${base} ${
              isActive
                ? "text-white shadow-sm"
                : "text-slate-600 hover:bg-blue-50 hover:text-[color:var(--fusion-blue)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function GroupTabs({
  groups,
  activeGroupId,
  pathname,
  moduleId,
}: {
  groups: NavTabGroup[];
  activeGroupId?: string;
  pathname: string;
  moduleId: string;
}) {
  const activeGroup =
    groups.find((group) => group.tabs.some((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))) ??
    groups.find((group) => group.id === activeGroupId) ??
    groups[0];

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto scroll-smooth pb-0.5 [scrollbar-width:thin]">
        {groups.map((group) => {
          const isActive = group.id === activeGroup?.id;
          const href = group.tabs[0]?.href ?? "#";
          return (
            <Link
              key={group.id}
              href={href}
              onClick={() => rememberModuleTab(moduleId, href)}
              style={isActive ? { background: "var(--fusion-gradient)" } : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {group.label}
            </Link>
          );
        })}
      </div>
      {activeGroup ? (
        <TabRow tabs={activeGroup.tabs} pathname={pathname} moduleId={moduleId} variant="secondary" />
      ) : null}
    </div>
  );
}

export function ModuleTabBar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const modules = useMemo(() => filterModules(permissions), [permissions]);
  const resolved = useMemo(() => resolveModule(pathname, modules), [pathname, modules]);

  useEffect(() => {
    if (resolved?.activeTab && !resolved.module.hideTabBar) {
      rememberModuleTab(resolved.module.id, resolved.activeTab.href);
    }
  }, [resolved?.module.id, resolved?.activeTab?.href, resolved?.module.hideTabBar]);

  if (!resolved || resolved.module.hideTabBar) return null;

  const { module, activeGroup } = resolved;

  return (
    <div
      data-print-hidden
      className="sticky top-12 z-10 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur-md md:top-12 md:px-7"
    >
      {module.tabGroups ? (
        <GroupTabs
          groups={module.tabGroups}
          activeGroupId={activeGroup?.id}
          pathname={pathname}
          moduleId={module.id}
        />
      ) : module.tabs ? (
        <TabRow tabs={module.tabs} pathname={pathname} moduleId={module.id} variant="secondary" />
      ) : null}
    </div>
  );
}
