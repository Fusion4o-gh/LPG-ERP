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
import { useLanguage } from "@/lib/i18n/LanguageProvider";

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
  const { t } = useLanguage();

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector('[data-active="true"]');
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
    }
  }, [pathname]);

  if (tabs.length === 0) return null;

  const base =
    variant === "primary"
      ? "whitespace-nowrap rounded px-2.5 py-1 text-xs font-bold"
      : "whitespace-nowrap rounded px-2.5 py-1 text-[12px] font-medium";

  return (
    <div ref={scrollRef} className="flex gap-0.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-active={isActive ? "true" : "false"}
            aria-current={isActive ? "page" : undefined}
            onClick={() => rememberModuleTab(moduleId, tab.href)}
            className={`${base} ${
              isActive
                ? "bg-gas-600 text-white"
                : "text-gas-700 hover:bg-white hover:text-gas-800"
            }`}
          >
            {t(tab.label)}
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
  const { t } = useLanguage();

  return (
    <div className="space-y-1.5">
      <div className="sticky top-0 z-[1] flex gap-0.5 overflow-x-auto bg-[var(--surface-muted)] pb-0.5 [scrollbar-width:thin]">
        {groups.map((group) => {
          const isActive = group.id === activeGroup?.id;
          const href = group.tabs[0]?.href ?? "#";
          return (
            <Link
              key={group.id}
              href={href}
              onClick={() => rememberModuleTab(moduleId, href)}
              className={`whitespace-nowrap rounded px-2.5 py-1 text-xs font-bold ${
                isActive ? "bg-gas-600 text-white" : "text-steel-600 hover:bg-white hover:text-gas-700"
              }`}
            >
              {t(group.label)}
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
      className="sticky top-11 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-1.5 md:px-4"
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
